import { NextResponse } from "next/server";
import { z } from "zod";
import { fingerprint, unseenAmong } from "@/lib/captures";
import { ZONE, zoneOffset } from "@/lib/clock";
import { conflictsForOnePerson, type Conflict, type Stop } from "@/lib/conflicts";
import { db } from "@/lib/db";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { logger } from "@/lib/logger";
import { currentPerson } from "@/lib/session";

// Turns a Spanish transcript into the list the "review plan" screen shows:
// events, tasks, and conflicts. Same reason this is a server route and not
// a client call as `/api/transcribe`: `NEBIUS_API_KEY` can't reach the
// browser.
//
// The split follows the project's technical thesis (CLAUDE.md, "La tesis
// técnica"): the model only extracts — titles, event-vs-task, times, due
// labels. Whether two events collide is arithmetic over timestamps, and it is
// `conflicts.ts` that does it, the same module the home screen and the clash
// screen use. The model is never asked whether something conflicts.

// This is the Token Factory API, called directly with `fetch` — no Mastra
// workflow exists in this repo yet, so there's no `nebius/` prefix on the
// model id here (that prefix is a Mastra-provider convention, confirmed
// against `.claude/skills/platform-docs/SKILL.md`: "En Mastra los modelos
// llevan prefijo `nebius/`. En la API de Token Factory no lo llevan.").
//
// Two base URLs circulate in Nebius's own documentation depending on its
// age: `api.studio.nebius.ai/v1` and `api.tokenfactory.nebius.com/v1`.
// Checked against the real key on 2026-09-19: the studio hosts answer
// `401` to a key that `api.tokenfactory.nebius.com/v1/models` accepts with
// `200`, so that's the live one. Not read from the environment, unlike the
// model id below: this is a stable endpoint, not a checkpoint Nebius can
// retire without warning.
const NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1";

// No hardcoded fallback, on purpose. The project already paid for one of
// these once: `meta-llama/Llama-3.3-70B-Instruct` sat as a default in
// `modelo.ts`, Nebius retired the checkpoint without redirecting traffic,
// and the whole chat stopped answering with nothing to say why (see the
// platform-docs skill, "Nebius", entry dated 2026-09-17). Failing loud when
// the variable is missing is cheaper than a silent outage later.
const MODEL_ENV_VAR = "NEBIUS_MODEL_SMALL";

// ISO 8601 local datetime, no timezone suffix — the transcript never states
// one. The zone is the household's and it is applied here, in `instant()`:
// asking a model which side of the October changeover a Thursday falls on is
// asking it arithmetic.
const ISO_LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * A wall-clock time the speaker meant, as the instant it really is.
 *
 * `new Date("2026-09-24T18:30:00")` reads that as the container's own local
 * time, and the container runs in UTC — so half past six in Madrid would be
 * stored as half past six in London and land on the calendar an hour early
 * all summer. The offset comes from the day itself, through `clock.ts`.
 */
function instant(localDateTime: string): Date | null {
  const day = localDateTime.slice(0, 10);
  const parsed = new Date(`${localDateTime}${zoneOffset(day)}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// What the model is asked for. Kept to what a language model actually has
// to interpret — free text into a title, a kind, and a time — and nothing
// it would have to reason about, like whether two of these collide.
const ExtractedItemSchema = z.object({
  title: z
    .string()
    .describe(
      "The event or task title, in the speaker's own Spanish words. Never translate or rephrase into English.",
    ),
  kind: z
    .enum(["event", "task"])
    .describe(
      "'event' if the speaker stated a specific clock time for it, 'task' if it has no fixed time (only, at most, a day it's due by).",
    ),
  start: z
    .string()
    .regex(ISO_LOCAL_DATETIME)
    .nullable()
    .describe(
      "ISO 8601 local datetime (YYYY-MM-DDTHH:MM:SS) the event starts. Resolve relative days ('el jueves') to the next real occurrence from the current date given in the prompt. Null for tasks, or for an event whose time wasn't stated.",
    ),
  end: z
    .string()
    .regex(ISO_LOCAL_DATETIME)
    .nullable()
    .describe(
      "ISO 8601 local datetime (YYYY-MM-DDTHH:MM:SS) the event ends, computed from a stated duration or end time. Null if it can't be derived from what was said.",
    ),
  dueLabel: z
    .string()
    .nullable()
    .describe(
      "For a task only: a short Spanish label for when it's due, in the speaker's own words (e.g. 'Antes del jueves'). Null for events.",
    ),
});

const ExtractionSchema = z.object({
  items: z.array(ExtractedItemSchema),
});

type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

export type PlanItem = {
  title: string;
  // Human-readable, e.g. "jue 18:30 – 19:30", "Antes del jueves", or a
  // conflict's own description. Built here, in TypeScript, from the
  // model's structured fields — the model is never asked to compose display
  // text, so it can't slip a translated or reworded title into it.
  detail: string;
  type: "event" | "task" | "conflict";
  /**
   * The saved capture this row can be confirmed onto a calendar, or null when
   * there is nothing to write: a task, a clash, an event nobody gave an hour,
   * or a visit with no session to write for. One field with one meaning, so a
   * screen showing a button never has to work out whether the button can do
   * anything.
   */
  captureId: string | null;
  /**
   * The day this row happens on, `YYYY-MM-DD` in the household's zone, or null
   * for anything with no time. On a clash it is what lets the card link to
   * that day's breakdown; the URL is built by the screen, not here.
   */
  day: string | null;
};

// Every formatter states the zone. Without it they read the container's, which
// is UTC, and a Madrid evening comes out an hour early half the year.
const WEEKDAY_TIME_FORMAT = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONE,
  weekday: "short",
});
const TIME_FORMAT = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// `en-CA` is the locale that formats a date as `YYYY-MM-DD`, which is what the
// day picker and the clash screen match on. Same trick as `todayInMadrid`.
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatEventDetail(start: Date, end: Date): string {
  const day = WEEKDAY_TIME_FORMAT.format(start);
  const from = TIME_FORMAT.format(start);
  const to = TIME_FORMAT.format(end);
  return `${day} ${from} – ${to}`;
}

/** An event that really does sit between two instants. Everything else — a
 *  task, or an event whose hour nobody said — comes back null and occupies no
 *  time, so it clashes with nothing and can be written nowhere. */
type Timed = { title: string; startsAt: Date; endsAt: Date };

function timed(item: ExtractedItem): Timed | null {
  if (item.kind !== "event" || !item.start || !item.end) return null;

  const startsAt = instant(item.start);
  const endsAt = instant(item.end);

  if (!startsAt || !endsAt) return null;

  return { title: item.title, startsAt, endsAt };
}

/**
 * `conflictsForOnePerson` needs a `personId` to group by, and everything
 * dictated in one go belongs to whoever is speaking. It is called directly
 * rather than through `detectConflicts`, so this value is never read — it is
 * here because the shape asks for it.
 */
const THE_SPEAKER = "the speaker";

/**
 * The clashes among what was just said, found by the same module the home
 * screen and the clash screen use.
 *
 * It used to compare every pair here, which turned four things at the same
 * hour into six cards saying the same thing. `conflicts.ts` had already
 * settled that question — consecutive stops only, so A-B and B-C read as two
 * problems in a row rather than three pairs — and having a second answer to
 * it in this file was one piece of knowledge written down twice, with the
 * worse version the one on screen.
 *
 * Nothing dictated here carries a place: this route's model is given no places
 * table, so no travel time can be computed and no trip is claimed. In practice
 * that means only real overlaps come out, but the copy is derived from
 * `reason` rather than assuming so.
 */
function findConflicts(events: Timed[]): PlanItem[] {
  const stops: Stop[] = events.map((event, index) => ({
    id: String(index),
    personId: THE_SPEAKER,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    place: null,
  }));

  return conflictsForOnePerson(stops).map(toConflictItem);
}

function toConflictItem(conflict: Conflict): PlanItem {
  const at = TIME_FORMAT.format(conflict.next.startsAt);
  const both = `${conflict.previous.title} y ${conflict.next.title}`;

  return {
    title:
      conflict.reason === "overlap"
        ? `Dos sitios a las ${at}`
        : `Sin tiempo para llegar a las ${at}`,
    detail:
      conflict.reason === "overlap"
        ? `${both} se solapan`
        : `De «${conflict.previous.title}» a «${conflict.next.title}» no da tiempo`,
    type: "conflict",
    // A clash is not a thing to write down, it is two things that do not fit.
    // The card links to the breakdown instead of offering a button.
    captureId: null,
    day: DAY_FORMAT.format(conflict.next.startsAt),
  };
}

/**
 * `captureIdFor` answers with the row a given event was saved as, or null when
 * nothing was saved — nobody signed in, so there is no calendar to write to.
 * It is passed in rather than looked up here because saving is a decision
 * about the request, and this function is only about shaping what the screen
 * draws.
 */
function toPlanItems(
  items: ExtractedItem[],
  captureIdFor: (event: Timed) => string | null,
): PlanItem[] {
  const timings = items.map(timed);

  const planItems: PlanItem[] = items.map((item, index) => {
    const when = timings[index];

    if (when) {
      return {
        title: item.title,
        detail: formatEventDetail(when.startsAt, when.endsAt),
        type: "event",
        captureId: captureIdFor(when),
        day: DAY_FORMAT.format(when.startsAt),
      };
    }

    return {
      title: item.title,
      // An event whose hour nobody said stays an event. Filing it as a task
      // would be tidier and would also be Mia deciding something nobody told
      // her; the screen says the hour is missing instead.
      detail: item.kind === "event" ? "" : (item.dueLabel ?? ""),
      type: item.kind,
      captureId: null,
      day: null,
    };
  });

  return [...planItems, ...findConflicts(timings.filter((when) => when !== null))];
}

/**
 * Saves what was just heard and answers with which row each thing became.
 *
 * Saving is NOT writing to a calendar. A capture is what Mia understood; an
 * event is what someone confirmed, and `googleEventId` is born empty so the
 * difference is visible in the data and not only in the prose. This is the
 * whole of rule 1 in one sentence.
 *
 * It exists because a brain dump you lose is not a brain dump: until this
 * route saved anything, everything dictated here vanished on leaving the
 * screen.
 */
async function saveCaptures(
  personId: string,
  items: ExtractedItem[],
): Promise<Map<string, string>> {
  const fresh = items.map((item) => {
    const when = timed(item);

    return {
      personId,
      // The interpreter's two labels that mean exactly these, so a capture
      // from this route and one from the workflow are the same kind of thing.
      kind: item.kind === "event" ? "stop" : "reminder",
      title: item.title,
      startsAt: when?.startsAt ?? null,
      endsAt: when?.endsAt ?? null,
      // This route's model is given no places table to choose from, unlike the
      // interpreter, so it extracts no place and none is guessed from a title.
      place: null,
    };
  });

  const titles = fresh.map((capture) => capture.title);

  const known = await db.capture.findMany({
    where: { personId, title: { in: titles } },
    select: { title: true, startsAt: true },
  });

  const unseen = unseenAmong(fresh, known);

  if (unseen.length > 0) await db.capture.createMany({ data: unseen });

  // Read back instead of trusting what was just written: this also has to
  // answer for the rows that already existed, which is what saying the same
  // sentence twice produces.
  const saved = await db.capture.findMany({
    where: { personId, title: { in: titles } },
    select: { id: true, title: true, startsAt: true },
  });

  logger.info("Saved what was heard as captures", {
    personId,
    saved: unseen.length,
    repeated: fresh.length - unseen.length,
  });

  return new Map(saved.map((capture) => [fingerprint(capture.title, capture.startsAt), capture.id]));
}

export async function POST(request: Request) {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing environment variable NEBIUS_API_KEY." },
      { status: 500 },
    );
  }

  const model = process.env[MODEL_ENV_VAR];
  if (!model) {
    return NextResponse.json(
      { error: `Missing environment variable ${MODEL_ENV_VAR}.` },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request isn't valid JSON." }, { status: 400 });
  }

  const parsedBody = z.object({ transcript: z.string().min(1) }).safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Missing or empty 'transcript' field in the request." },
      { status: 400 },
    );
  }
  const { transcript } = parsedBody.data;

  // Given to the model instead of trusted implicitly from training data or
  // system-clock drift on whichever host runs this: the model has to
  // resolve "el jueves" against a date it's actually told, not one it
  // assumes.
  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const jsonSchema = z.toJSONSchema(ExtractionSchema);

  let completion: Response;
  try {
    // 30s: measured live at ~4s for the model this route uses, but the
    // project's own benchmark saw other candidates take up to 29s for the
    // same kind of structured-output call — generous enough not to cut off
    // a slow-but-working response.
    completion = await fetchWithTimeout(
      `${NEBIUS_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                `Today is ${today}. Extract calendar events and tasks from a ` +
                "Spanish voice transcript into structured data. Resolve " +
                "relative day references ('el jueves', 'mañana') to the next " +
                "real occurrence from today. This is extraction only: never " +
                "decide whether two items conflict with each other, and never " +
                "translate the speaker's words.",
            },
            { role: "user", content: transcript },
          ],
          // The project's hard rule for every Nebius call (CLAUDE.md, "Code
          // conventions"): structured output via JSON Schema, which turns on
          // constrained decoding in vLLM. No defensive parsing and no retry
          // on bad formatting below, because the schema makes bad formatting
          // impossible rather than merely unlikely.
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "plan_extraction",
              schema: jsonSchema,
              strict: true,
            },
          },
        }),
      },
      30_000,
    );
  } catch (error) {
    logger.error("Failed to reach Nebius", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to reach Nebius." }, { status: 502 });
  }

  if (!completion.ok) {
    const errorBody = await completion.text();
    logger.error("Nebius rejected the extraction request", {
      status: completion.status,
      body: errorBody,
    });
    return NextResponse.json(
      { error: `Nebius responded with status ${completion.status}.` },
      { status: 502 },
    );
  }

  let extraction: z.infer<typeof ExtractionSchema>;
  try {
    const completionBody = (await completion.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = completionBody.choices[0]?.message.content ?? "";
    extraction = ExtractionSchema.parse(JSON.parse(content));
  } catch (error) {
    // Constrained decoding makes bad JSON unlikely, not impossible — this
    // project's own measurements found format failures at 0% but content
    // accuracy well under 100%, so a still-malformed or schema-violating
    // response is a real, if rare, external-API failure to guard against
    // rather than let crash the request.
    logger.error("Nebius's response wasn't the extraction schema expected", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Nebius's response couldn't be read." },
      { status: 502 },
    );
  }

  // Signing in is what gives a capture an owner. Without it the plan is still
  // worked out and shown — there is nothing wrong with dictating before
  // connecting anything — but it belongs to nobody, so it is saved nowhere and
  // no row comes back with an id to confirm.
  const person = await currentPerson();

  let captureIds: Map<string, string> | null = null;

  if (person) {
    try {
      captureIds = await saveCaptures(person.id, extraction.items);
    } catch (error) {
      // Failing loud rather than returning a plan that looks captured and is
      // not. Whoever is on the screen sees Mia could not finish and says it
      // again, which is worse than it working and better than believing it was
      // written down.
      logger.error("Could not save what was heard", {
        personId: person.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        { error: "What was heard could not be saved." },
        { status: 500 },
      );
    }
  }

  const items = toPlanItems(
    extraction.items,
    (event) => captureIds?.get(fingerprint(event.title, event.startsAt)) ?? null,
  );

  logger.info("Structured a transcript into a plan", {
    transcriptLength: transcript.length,
    itemCount: items.length,
    signedIn: person !== null,
  });

  return NextResponse.json({ items });
}
