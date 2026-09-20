import { after, NextResponse } from "next/server";
import { z } from "zod";
import { supportNetwork } from "@/lib/household";
import { inviteToCall } from "@/lib/invite";
import { log, reason } from "@/lib/log";
import { notifyRoom, openRoom } from "@/lib/room";
import { currentPerson } from "@/lib/session";
import { sendSignal } from "@/lib/video";
import { bothHaveRuledItOut, isAnInviteCommand, matchInvitedPerson, type Utterance } from "@/mastra/listening";
import { giveMiaTheFloor, runWaitingForTheCall } from "@/mastra/workflows/listening";

/**
 * What Mia hears inside the call, and what she does with it.
 *
 * This is where "asking for the floor" comes to mean something. The lines
 * transcribed by Vonage arrive here, and when the situation changes — both
 * have said they cannot — the run wakes and the negotiator proposes with that
 * in front. Until then Mia is genuinely quiet, not waiting on a timer.
 *
 * The transcript lives in memory and is lost on restart. Deliberate debt: a
 * call lasts three minutes and a process restarting halfway cuts it anyway.
 * What survives is the decision, because that goes to the run in Postgres.
 * Nothing of the text is logged: it is a couple's conversation.
 *
 * The same lines are also checked for "invita a Rosa" (spec 0009), which is
 * a different question from whether both have ruled the plan out and is
 * answered independently of it.
 */

const requestSchema = z
  .object({
    text: z.string().max(2000),
    who: z.string().min(1).max(200).optional().describe("The stream it came from, so it is not counted twice"),
    // Set by a manual "give her the floor", the net under the automatic trigger.
    force: z.boolean().optional(),
  })
  // Asking her to step in is a press, not something said: it carries neither a
  // line nor a stream. Anything else has to carry both.
  .refine((body) => body.force === true || (body.text.length > 0 && body.who !== undefined), {
    message: "something has to have been said, and by someone",
    path: ["text"],
  });

/**
 * What was said in each room, without repeats and without losing who said it.
 * Both people send the same thing — each browser receives both streams'
 * captions — so without deduplicating, the conversation would reach the
 * negotiator twice. Deduplicated by stream AND line, which is also what tells
 * two people saying no from one person saying it twice.
 */
const SAID = new Map<string, Map<string, Utterance>>();

/** How much of a conversation is kept. Three minutes of two people fit easily. */
const MAX_LINES = 200;

/**
 * The runs already given the floor. Both browsers hear the same and decide
 * the same at once: without this both wake the run and the second meets
 * "this workflow run was not suspended". An in-memory lock, and that is
 * enough: what it protects lasts the two seconds the run takes to resume.
 */
const ALREADY_WOKEN = new Set<string>();

/**
 * Which support-network person was texted in the last minute. Guards against
 * the duplicate this route sees by construction: the same spoken sentence
 * reaches here once per browser subscribed to the speaker's stream —
 * normally two, three once a guest is in the room — each POST authenticated
 * as a different core person. Keyed by who is invited, not by the caption's
 * text: nothing else is shared between those requests to deduplicate on.
 */
const RECENTLY_INVITED = new Map<string, number>();

const INVITE_COOLDOWN_MS = 60_000;

/**
 * Detects and acts on "invita a Rosa", independent of whether a workflow run
 * is waiting for the call: asking for the support network is not part of the
 * negotiation the run tracks, and gating it on a waiting run would silently
 * drop the command the rest of the time.
 */
async function handleInviteCommand(text: string): Promise<void> {
  const sessionId = await openRoom();

  if (!sessionId) return;

  const network = await supportNetwork();
  const matched = matchInvitedPerson(text, network);

  if (!matched) {
    await sendSignal(sessionId, "invite", JSON.stringify({ status: "unclear" }));
    return;
  }

  const lastInvited = RECENTLY_INVITED.get(matched.id) ?? 0;

  if (Date.now() - lastInvited < INVITE_COOLDOWN_MS) return;

  RECENTLY_INVITED.set(matched.id, Date.now());

  await inviteToCall(sessionId, matched);
}

export async function POST(request: Request) {
  let person: Awaited<ReturnType<typeof currentPerson>>;

  // Reading who you are is a query, and a database that is down throws rather
  // than answering nobody. Uncaught it would leave a caption with no answer and
  // no line in the log, which is the failure this route exists to make visible.
  try {
    person = await currentPerson();
  } catch (error) {
    log.error("listening: could not tell who is asking", { reason: reason(error) });

    return NextResponse.json({ error: "could not process" }, { status: 503 });
  }

  if (!person) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  if (person.circle !== "CORE") {
    return NextResponse.json({ error: "this room is not yours" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const validated = requestSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json({ error: "invalid request", detail: validated.error.issues }, { status: 400 });
  }

  const { text, who, force } = validated.data;

  // Checked before anything else, and outside the run-waiting logic below:
  // inviting the support network is not part of the negotiation a run
  // tracks, so it has to work whether or not one is waiting.
  if (isAnInviteCommand(text)) {
    after(() => handleInviteCommand(text));
  }

  try {
    const waiting = await runWaitingForTheCall();

    // Without a waiting run there is nothing to wake. Still a 200 — from the
    // client this is "I heard you" — but it says WHICH silence it is: Mia
    // having no day looked at is nothing like having one and having heard
    // nothing that makes her speak.
    if (!waiting) {
      return NextResponse.json({ speaks: false, why: null, because: "no-day-looked-at" });
    }

    const { runId } = waiting;
    const said = SAID.get(runId) ?? new Map<string, Utterance>();

    // An empty text is the button, not a line: it would reach the negotiator as
    // someone who spoke and said nothing.
    if (who && text.length > 0 && said.size < MAX_LINES) said.set(`${who}: ${text}`, { who, text });

    SAID.set(runId, said);

    const conversation = [...said.values()];

    // Mia waits until both have ruled it out. While they are working it out
    // between themselves she has nothing to add.
    if (!force && !bothHaveRuledItOut(conversation)) {
      return NextResponse.json({ speaks: false, why: null, because: "still-talking" });
    }

    // Whoever arrives second does not wake it again. Answered that she
    // speaks, because it is true: she already is.
    if (ALREADY_WOKEN.has(runId)) {
      return NextResponse.json({ speaks: true, why: "already-speaking" });
    }

    ALREADY_WOKEN.add(runId);

    const why = force ? "called-by-name" : "both-said-no";

    log.info("listening: Mia has something to say", { runId, personId: person.id, why, linesHeard: said.size });

    // The whole text, in order: the negotiator needs the conversation, not the
    // last loose line. What was ruled out is already in there.
    const asText = conversation.map((line) => `${line.who}: ${line.text}`).join("\n");

    after(async () => {
      const resumed = await giveMiaTheFloor(runId, asText);

      if (resumed) {
        SAID.delete(runId);
        await notifyRoom(runId);
      } else {
        // It did not go on, so the lock is spare: if it was a stumble, let the
        // next line try again.
        ALREADY_WOKEN.delete(runId);
      }
    });

    return NextResponse.json({ speaks: true, why }, { status: 202 });
  } catch (error) {
    log.error("listening: could not process what was heard", { personId: person.id, reason: reason(error) });

    return NextResponse.json({ error: "could not process" }, { status: 500 });
  }
}
