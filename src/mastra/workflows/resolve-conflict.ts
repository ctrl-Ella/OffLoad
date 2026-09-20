import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { findPlace } from "@/data/places";
import { todayInMadrid, zoneOffset, ZONE } from "@/lib/clock";
import { detectConflicts, type Coordinates } from "@/lib/conflicts";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { coreJourney } from "@/lib/schedule";
import { intentSchema, interpretDump, NO_PLACE, type Intent } from "@/mastra/agents/interpreter";
import { NOBODY, propose } from "@/mastra/agents/negotiator";
import { createConfirmationStep } from "./ask-for-confirmation";
import { caseFileSchema } from "./case-file";
import { conflictSchema, dehydrateConflict, dehydrateStop, hydrateStops, stopSchema } from "./schemas";

/**
 * `resolveConflict` · the product's state machine.
 *
 * Of its eight steps two touch a model, and the one that decides the most
 * touches none. That count is the project's technical thesis written as a
 * list. Times travel as ISO text and not `Date`: the run's state is persisted
 * in Postgres as JSON between a suspension and its resumption, and a date does
 * not survive that trip. The conversion lives whole in `schemas.ts`.
 */

const inputSchema = z.object({
  personId: z.string().describe("Who starts the run. Their day is looked at first"),
  day: z.string().optional().describe("The day to look at, YYYY-MM-DD. Today in the household's zone by default"),
  /**
   * What they just blurted out, transcribed or written as is. Empty means
   * "look at my day and that is all": what happens when someone enters the
   * video call without having dictated anything. Without this door Mia could
   * only know of a clash if someone told her first.
   */
  text: z.string().default("").describe("What was just blurted out. Empty to only look at the day"),
});

const interpretedSchema = z.object({
  personId: z.string(),
  day: z.string(),
  intents: z.array(intentSchema).describe("Everything that was said, split into loose things"),
});

/** How long something lasts when nobody said how long. */
const DEFAULT_DURATION_MIN = 60;

/**
 * From an intent with a time to a stop that can enter the arithmetic. The
 * model gives a wall-clock time and a relative day; the ISO is composed here.
 * Asking a model to get the summer offset right is asking it arithmetic.
 */
function newStopFrom(
  intent: Intent,
  day: string,
): { title: string; startsAt: Date; endsAt: Date; place: Coordinates | null } | null {
  if (!intent.startTime) return null;

  const date = new Date(`${day}T00:00:00Z`);

  if (intent.when === "mañana") date.setUTCDate(date.getUTCDate() + 1);

  const itsDay = date.toISOString().slice(0, 10);
  const startsAt = new Date(`${itsDay}T${intent.startTime}:00${zoneOffset(itsDay)}`);

  if (Number.isNaN(startsAt.getTime())) return null;

  const duration = intent.durationMin ?? DEFAULT_DURATION_MIN;

  return {
    title: intent.title,
    startsAt,
    endsAt: new Date(startsAt.getTime() + duration * 60_000),
    // From the place, never the title: "Piscina del niño" is not in the table
    // and "Piscina" is. Without a place no trip is claimed.
    place: intent.place === NO_PLACE ? null : findPlace(intent.place),
  };
}

/**
 * Step 1 · from what someone blurts out to typed things. The first of the two
 * steps that touch a model, and the smaller. What Mia heard is saved here as
 * captures, and saving it is NOT writing it to a calendar: a capture is what
 * Mia understood, an event is what someone confirmed. Rule 1 lives on that
 * border, in `googleEventId`, which is born empty.
 */
const interpret = createStep({
  id: "interpret",
  inputSchema,
  outputSchema: interpretedSchema,
  execute: async ({ inputData, runId }) => {
    const day = inputData.day ?? todayInMadrid();

    // Without text the model is not asked: a run that only looks at the day
    // has nothing to interpret, and paying an inference for an empty string
    // buys an answer that there is nothing.
    const intents = inputData.text.trim() === "" ? [] : await interpretDump({ text: inputData.text });

    log.info(intents.length === 0 ? "workflow: no dump, only looking at the day" : "workflow: dump interpreted", {
      runId,
      step: "interpret",
      count: intents.length,
      // The kinds yes, the content no: what was dictated is a couple's conversation.
      kinds: intents.map((intent) => intent.kind).join(","),
    });

    const fresh = intents.map((intent) => {
      const when = newStopFrom(intent, day);

      return {
        personId: inputData.personId,
        kind: intent.kind,
        title: intent.title,
        startsAt: when?.startsAt ?? null,
        endsAt: when?.endsAt ?? null,
        place: intent.place === NO_PLACE ? null : intent.place,
        runId,
      };
    });

    // Saying the same thing twice is normal and must not duplicate anything.
    // Equality is by person, title and time: two things with the same name at
    // different times are two things.
    const known = await db.capture.findMany({
      where: { personId: inputData.personId, title: { in: fresh.map((capture) => capture.title) } },
      select: { title: true, startsAt: true },
    });

    const fingerprint = (title: string, startsAt: Date | null) =>
      `${title.toLowerCase()}|${startsAt?.toISOString() ?? ""}`;

    const seen = new Set(known.map((capture) => fingerprint(capture.title, capture.startsAt)));
    const unseen = fresh.filter((capture) => !seen.has(fingerprint(capture.title, capture.startsAt)));

    if (unseen.length > 0) await db.capture.createMany({ data: unseen });

    log.info("workflow: captures saved", {
      runId,
      step: "interpret",
      saved: unseen.length,
      repeated: fresh.length - unseen.length,
    });

    return { personId: inputData.personId, day, intents };
  },
});

const calendarsSchema = z.object({
  personId: z.string(),
  day: z.string(),
  stops: z.array(stopSchema).describe("The whole core circle's day, everyone at once"),
  /**
   * Whose calendar could really be read. Not the same as who is in the core:
   * someone who has not connected Google, or whose calendar did not answer,
   * comes out with no stops — and zero stops reads like a free day. Of whoever
   * is not on this list no availability is claimed: rule 3 applied inside the
   * house and not only to the support network.
   */
  visibleCalendars: z.array(z.string()).describe("The ids of those whose calendar was read this run"),
  intents: z.array(intentSchema).describe("Everything that was said. Those that do not open the run stay pending"),
});

/**
 * Step 2 · the core circle's calendars, ALL of them and not only the
 * starter's: the next steps have to look at the other person's day before
 * proposing anything. The captures Mia has heard and nobody confirmed come
 * along, which is what makes the stop that opened this run count. Whoever
 * has no Google comes out with no stops and it is said in the log: not an
 * error of the run, someone Mia does not see.
 */
const readCalendars = createStep({
  id: "readCalendars",
  inputSchema: interpretedSchema,
  outputSchema: calendarsSchema,
  execute: async ({ inputData, runId }) => {
    const lanes = await coreJourney(inputData.day);

    for (const lane of lanes) {
      if (lane.status !== "ready") {
        log.info("workflow: a calendar could not be read", {
          runId,
          step: "readCalendars",
          personId: lane.personId,
          status: lane.status,
        });
      }
    }

    const stops = lanes.flatMap((lane) => lane.stops.map(dehydrateStop));
    const visibleCalendars = lanes.filter((lane) => lane.status === "ready").map((lane) => lane.personId);

    log.info("workflow: calendars read", {
      runId,
      step: "readCalendars",
      day: inputData.day,
      stops: stops.length,
      visibleCalendars: visibleCalendars.length,
    });

    return { ...inputData, stops, visibleCalendars };
  },
});

const findingSchema = calendarsSchema.extend({
  conflict: conflictSchema.nullable().describe("The clash to resolve, or null if the day fits"),
  /**
   * What was said in the call before Mia opened her mouth. Null when there
   * was no call, because there was no clash or because someone gave her the
   * floor without talking. The negotiator uses it to propose knowing what was
   * already ruled out aloud.
   */
  heard: z.string().nullable().describe("The transcript of what was said in the call, or null if nothing"),
});

/**
 * Step 3 · the clash, if there is one. The step that decides the most in the
 * whole workflow, and it touches no model: all the arithmetic lives in
 * `conflicts.ts`. The starter's first clash is chosen; if the other person
 * has a clash of their own that day, it is another problem and not this one.
 */
const detectConflict = createStep({
  id: "detectConflict",
  inputSchema: calendarsSchema,
  outputSchema: findingSchema,
  execute: async ({ inputData, runId }) => {
    const all = detectConflicts(hydrateStops(inputData.stops));
    const mine = all.find((conflict) => conflict.previous.personId === inputData.personId);

    // The message says which of the three cases happened. On Railway the log
    // is the only debugging surface, and a line that needs interpreting is a
    // line that does not help at three in the morning.
    const whatHappened = mine
      ? "workflow: clash detected"
      : all.length > 0
        ? "workflow: clashes in the core, none of the person who asked"
        : "workflow: the day fits, no clashes";

    log.info(whatHappened, {
      runId,
      step: "detectConflict",
      inTheCore: all.length,
      // No titles and no places: personal data, and this is a log.
      reasonOfMine: mine?.reason ?? null,
    });

    return { ...inputData, conflict: mine ? dehydrateConflict(mine) : null, heard: null };
  },
});

/**
 * Step 3 bis · Mia waits for them to talk, and listens.
 *
 * It exists because Mia was proposing before listening to anyone: the eight
 * steps ran straight through, so by the time someone opened the call the
 * proposal had been ready for a while and Mia entered the room with her hand
 * already up. So the run stops here. What wakes it is what is said inside the
 * call, and with that in front the negotiator proposes.
 *
 * Without a clash it waits for nobody. And what suspends here is not a card:
 * nobody has to answer anything yet, so the payload carries a `waitingFor`
 * instead of a question, and `proposals.ts` drops it.
 */
const listenToTheCall = createStep({
  id: "listenToTheCall",
  inputSchema: findingSchema,
  outputSchema: findingSchema,
  suspendSchema: z.object({
    waitingFor: z.string().describe("What is being waited for, readable in the snapshot"),
    /**
     * What the clash is about, so the listening knows what it recognises.
     * Titles as they are in the calendar and nothing more: no times and no
     * people, since a route reads this.
     */
    about: z.array(z.string()).describe("The titles of the two clashing stops"),
  }),
  resumeSchema: z.object({
    heard: z.string().describe("What was said in the call, transcribed. Empty if given the floor without talking"),
  }),
  execute: async ({ inputData, resumeData, suspend, runId }) => {
    if (resumeData) {
      log.info("workflow: Mia takes the floor", {
        runId,
        step: "listenToTheCall",
        // The text no: a couple's conversation, and this is a log.
        talkedFirst: resumeData.heard.trim() !== "",
      });

      return { ...inputData, heard: resumeData.heard || null };
    }

    if (!inputData.conflict) return inputData;

    log.info("workflow: waiting for the call", { runId, step: "listenToTheCall" });

    await suspend({
      waitingFor: "them to talk it through",
      about: [inputData.conflict.previous.title, inputData.conflict.next.title],
    });

    return inputData;
  },
});

/** A time as it is shown to someone: «18:30», in the household's zone. Spanish, since Mia says it. */
function time(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONE }).format(
    new Date(iso),
  );
}

/**
 * Step 4 · whom it makes sense to ask. The second and last step that touches
 * a model. The negotiator gets the core MINUS whoever has the clash, and the
 * reason that person cannot goes inside `situation`. It returns a NAME and
 * the card needs an identifier, so it is translated here.
 */
const proposeStep = createStep({
  id: "propose",
  inputSchema: findingSchema,
  outputSchema: caseFileSchema,
  execute: async ({ inputData, runId }) => {
    const empty = { proposal: null, answers: {}, names: {}, supportNetwork: [] };

    if (!inputData.conflict) {
      log.info("workflow: no clash, nothing to propose", { runId, step: "propose" });

      return { ...inputData, ...empty };
    }

    const people = await db.person.findMany({ select: { id: true, name: true, circle: true } });

    const byName = new Map(people.map((person) => [person.name, person.id]));
    const supportNetwork = people.filter((person) => person.circle === "SUPPORT").map((person) => person.name);

    const { previous, next } = inputData.conflict;
    const slot = `${time(previous.endsAt)}-${time(next.endsAt)}`;

    // The core minus whoever has the clash, and minus whoever has no calendar
    // read this run: of that person the list would come out empty, and an
    // empty list reads as "free" when it means "I don't know".
    const others = people.filter(
      (person) =>
        person.circle === "CORE" &&
        person.id !== inputData.personId &&
        inputData.visibleCalendars.includes(person.id),
    );

    const coreCalendars = Object.fromEntries(
      others.map((person) => [
        person.name,
        inputData.stops
          .filter(
            (stop) =>
              stop.personId === person.id &&
              // Overlaps the slot: starts before it ends and ends after it starts.
              stop.startsAt < next.endsAt &&
              stop.endsAt > previous.endsAt,
          )
          .map((stop) => `${time(stop.startsAt)}-${time(stop.endsAt)} ${stop.title}`),
      ]),
    );

    const whoCannot = people.find((person) => person.id === inputData.personId)?.name;

    const situation =
      `${next.title}, a las ${time(next.startsAt)}. ` +
      `${whoCannot ?? "Quien lo tenía"} no llega: sale de «${previous.title}» ` +
      `a las ${time(previous.endsAt)} y no da tiempo.`;

    const proposal = await propose({
      situation,
      slot,
      coreCalendars,
      supportNetwork,
      heard: inputData.heard,
    });

    log.info("workflow: proposal built", {
      runId,
      step: "propose",
      decision: proposal.decision,
      // The name no: personal data.
      isInTheCore: others.some((person) => person.name === proposal.person),
    });

    return {
      ...inputData,
      answers: {},
      names: Object.fromEntries(people.map((person) => [person.id, person.name])),
      supportNetwork,
      proposal: {
        decision: proposal.decision,
        personName: proposal.person,
        personId: proposal.person === NOBODY ? null : (byName.get(proposal.person) ?? null),
        reason: proposal.reason,
      },
    };
  },
});

/** «Nicolás, Rosa y Marta», with the comma and the «y» where they go. */
function enumerate(names: string[]): string {
  return new Intl.ListFormat("es-ES", { type: "conjunction" }).format(names);
}

/**
 * Step 5, first time · the partner is asked. Only suspends when the
 * negotiator chose someone in the core. If it said the network has to be
 * called, this step has nothing to ask and passes through: whoever started
 * decides that, in the next step.
 */
const askPartner = createConfirmationStep({
  id: "askPartner",
  card: (data) => {
    const { proposal, conflict } = data;

    if (!conflict || proposal?.decision !== "propose" || !proposal.personId) return null;

    const whoCannot = data.names[data.personId] ?? "Quien lo tenía";

    // The last thing they have before, so they know where they would leave
    // from. The negotiator's `reason` does NOT go here: it is the model
    // explaining itself, and whoever reads the card needs to decide, not to
    // audit Mia.
    const theirsBefore = data.stops
      .filter((stop) => stop.personId === proposal.personId && stop.endsAt <= conflict.next.startsAt)
      .map((stop) => stop.endsAt)
      .sort();

    const last = theirsBefore.at(-1);

    return {
      recipientId: proposal.personId,
      recipientName: proposal.personName,
      question:
        `${conflict.next.title}, a las ${time(conflict.next.startsAt)}. ` +
        `${whoCannot} no llega. ¿Puedes ir tú?`,
      detail:
        `${time(conflict.next.startsAt)}–${time(conflict.next.endsAt)}` +
        (last ? ` · acabas a las ${time(last)}` : ""),
      // The question is spoken, so it is Spanish; the buttons are screen.
      yesLabel: "I'll go",
      noLabel: "I can't",
    };
  },
});

/**
 * Step 5, second time · whoever started is asked whether we call. Mia does
 * not open the call to the network on her own when the partner says no: it
 * interrupts three people at once, so the rule applies to itself and she
 * asks. Two situations end in the same question: the partner said no, or
 * nobody in the core could from the start. And here rule 3 shows: of the
 * support network it is said that they exist, never that they are free.
 */
const askWhetherToCall = createConfirmationStep({
  id: "askWhetherToCall",
  card: (data) => {
    const { proposal } = data;

    if (!proposal || data.supportNetwork.length === 0) return null;

    const partnerSaidNo = data.answers.askPartner === false;

    // `no-way-out` counts the same as `call` while there is someone in the
    // network: saying "no way out" with three people to call is claiming
    // something only asking can tell. The label is a model's choice; this
    // does not depend on it being right.
    const nobodyInTheCore = proposal.decision === "call" || proposal.decision === "no-way-out";

    if (!partnerSaidNo && !nobodyInTheCore) return null;

    const why = partnerSaidNo ? `${proposal.personName} no puede.` : "Del núcleo no puede nadie.";

    return {
      recipientId: data.personId,
      recipientName: data.names[data.personId] ?? "",
      question: `${why} En tu red tienes a ${enumerate(data.supportNetwork)}. ¿Llamo a alguno?`,
      detail: "No sé si pueden. Para saberlo hay que preguntárselo.",
      yesLabel: "Call",
      noLabel: "I'll sort it out",
    };
  },
});

export const resolveConflict = createWorkflow({
  id: "resolveConflict",
  inputSchema,
  outputSchema: caseFileSchema,
})
  .then(interpret)
  .then(readCalendars)
  .then(detectConflict)
  .then(listenToTheCall)
  .then(proposeStep)
  .then(askPartner)
  .then(askWhetherToCall)
  .commit();
