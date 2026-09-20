import { createWorkflowStateReader } from "@mastra/core/workflows";
import { log, reason } from "@/lib/log";
import { mastra } from "@/mastra";

/**
 * The run waiting for people to talk, and how Mia is given the floor.
 *
 * Apart from `proposals.ts` because it answers another question: that one
 * looks for what someone has to answer, this one for a run stopped before
 * proposing anything. Two different suspensions of the same workflow.
 */

/** The step where the run waits. Has to match the workflow's. */
const STEP = "listenToTheCall";

/** How many suspended runs are looked at in one go. A weekend's worth fits. */
const MAX_RUNS = 50;

/** The waiting run, and what its clash is about. */
export type WaitingForTheCall = {
  runId: string;
  /** The titles of the two clashing stops. It is what the listening recognises. */
  about: string[];
};

/**
 * The run waiting for people to talk, if there is one. The most recent: a
 * weekend of rehearsals leaves stopped runs behind, and waking the oldest
 * would be answering a conversation from an hour ago.
 *
 * A store that cannot be read throws from here instead of answering null. Both
 * callers catch it, and "nothing is waiting" is an answer Mia acts on: it is
 * not the same as not having been able to look.
 */
export async function runWaitingForTheCall(): Promise<WaitingForTheCall | null> {
  const workflow = mastra.getWorkflow("resolveConflict");

  const suspended = await workflow.listWorkflowRuns({ status: "suspended", page: 0, perPage: MAX_RUNS });

  for (const run of suspended.runs) {
    const state = await workflow.getWorkflowRunById(run.runId);

    if (!state) continue;

    const stopped = createWorkflowStateReader(state).getSuspendedStep();

    if (stopped?.stepId !== STEP) continue;

    // Untyped from the snapshot. Without the titles the run can still be
    // woken; what is lost is recognising what they are talking about.
    const payload = stopped.suspendPayload;
    const about =
      typeof payload === "object" && payload !== null && "about" in payload
        ? (payload.about as unknown)
        : null;

    return {
      runId: run.runId,
      about: Array.isArray(about) ? about.filter((t): t is string => typeof t === "string") : [],
    };
  }

  return null;
}

/** The looks at the day, one after another: the guard inside `look` protects
 *  nothing until the first run has suspended, and two people join seconds
 *  apart. In memory and one instance, like the lock in `/api/room/heard`. */
let queue: Promise<void> = Promise.resolve();

export function letHerLookAtTheDay(personId: string): Promise<void> {
  queue = queue.then(() => look(personId)).catch(() => undefined);

  return queue;
}

/**
 * Have Mia look at the household's day, without anyone having told her
 * anything. It is what gives her something to talk about in the call: before
 * this she only knew of a clash if someone had dictated it first, so whoever
 * entered the room directly met a Mia with no idea of their day.
 *
 * Starts a run with empty text, which skips the interpreter and goes straight
 * to reading calendars and finding clashes. If one is already waiting it does
 * nothing: two people entering at once cannot leave two runs looking at the
 * same thing.
 */
async function look(personId: string): Promise<void> {
  try {
    // Whoever enters second finds the run the first started and touches nothing.
    if (await runWaitingForTheCall()) return;

    const workflow = mastra.getWorkflow("resolveConflict");

    // A new call starts clean. What was left waiting from an earlier
    // conversation is not this one's, and Mia always takes the most recent:
    // without this, entering the room greets you with a card from an hour ago
    // before anyone has opened their mouth.
    const old = await workflow.listWorkflowRuns({ status: "suspended", page: 0, perPage: MAX_RUNS });

    // Together and not one after another: this is on the way into the room,
    // and a weekend of rehearsals can leave fifty runs to clear.
    await Promise.all(old.runs.map((run) => workflow.deleteWorkflowRunById(run.runId)));

    if (old.runs.length > 0) {
      log.info("listening: earlier conversations discarded", { count: old.runs.length });
    }

    const run = await workflow.createRun({ resourceId: personId });

    log.info("listening: Mia looks at the day", { runId: run.runId, personId });

    await run.start({ inputData: { personId, text: "" } });
  } catch (error) {
    // Not being able to look at the day does not break the call: people talk
    // anyway, and what is lost is Mia having something to bring.
    log.warn("listening: could not look at the day", { personId, reason: reason(error) });
  }
}

/**
 * Give Mia the floor: the run goes on and proposes with what was heard.
 * The text is not logged. It is a couple's conversation: what is recorded is
 * that it happened and how much was said, never what.
 */
export async function giveMiaTheFloor(runId: string, heard: string): Promise<boolean> {
  try {
    const workflow = mastra.getWorkflow("resolveConflict");
    const run = await workflow.createRun({ runId });

    const result = await run.resume({ step: STEP, resumeData: { heard } });

    log.info("listening: Mia takes the floor", { runId, status: result.status, heardCharacters: heard.length });

    return true;
  } catch (error) {
    // Two triggers in a row land here: the second finds the run already
    // claimed. Nobody's fault.
    log.warn("listening: could not give the floor", { runId, reason: reason(error) });

    return false;
  }
}
