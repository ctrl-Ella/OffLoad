import { createWorkflowStateReader } from "@mastra/core/workflows";
import { log } from "@/lib/log";
import { mastra } from "@/mastra";
import { cardSchema, type Card } from "./schemas";

/**
 * The questions Mia has open, and who can answer them.
 *
 * No new Prisma table: a suspended run is already in Postgres with all that is
 * needed, and inside each one is the card. A table repeating that would be the
 * same truth in two places.
 *
 * Why the fine filter is here and not in the query: `listWorkflowRuns` takes a
 * `resourceId`, but that field is set on creation and this workflow asks two
 * different people at different moments. And a stronger reason: if that
 * column did not exist in the table, the Postgres adapter skips the filter and
 * returns everyone's runs with a warning in the log. A filter that fails open
 * cannot hold an authorisation. The card's recipient holds it.
 */

/** An open question, checked and ready to paint. */
export type OpenProposal = Card & {
  runId: string;
  /** The step it resumes by. From the snapshot, not from a constant. */
  stepId: string;
};

/** How many suspended runs are looked at in one go. A weekend's worth fits. */
const MAX_RUNS = 50;

async function readSuspension(runId: string): Promise<OpenProposal | null> {
  const workflow = mastra.getWorkflow("resolveConflict");
  const state = await workflow.getWorkflowRunById(runId);

  if (!state) return null;

  const suspended = createWorkflowStateReader(state).getSuspendedStep();

  if (!suspended) return null;

  // Not everything that suspends is a question. The run also stops waiting
  // for people to talk in the call, and that is not a card. It is told apart
  // because it carries no question, and dropped in silence: warning about it
  // on every poll would fill the log with something that is not a problem.
  const payload = suspended.suspendPayload;
  const looksLikeACard = typeof payload === "object" && payload !== null && "question" in payload;

  if (!looksLikeACard) return null;

  // Untyped, and possibly from a run created before the card had this shape.
  // What does not validate is not painted.
  const card = cardSchema.safeParse(payload);

  if (!card.success) {
    log.warn("proposals: snapshot with a card that does not fit", { runId, step: suspended.stepId });
    return null;
  }

  return { ...card.data, runId, stepId: suspended.stepId };
}

/** What one person has to answer right now. */
export async function openProposalsFor(personId: string): Promise<OpenProposal[]> {
  const workflow = mastra.getWorkflow("resolveConflict");

  const suspended = await workflow.listWorkflowRuns({ status: "suspended", page: 0, perPage: MAX_RUNS });

  const open = await Promise.all(suspended.runs.map((run) => readSuspension(run.runId)));

  return open.filter(
    (proposal): proposal is OpenProposal => proposal !== null && proposal.recipientId === personId,
  );
}

/** One specific question, to check that whoever answers is who was asked. */
export async function proposalOf(runId: string): Promise<OpenProposal | null> {
  return readSuspension(runId);
}

/**
 * The question open right now, whoever it is for.
 *
 * Does not filter by recipient, and `openProposalsFor` does. Two different
 * places: outside the call each person is shown their own. Inside, Elvia and
 * Carlos look at the same screen and talk out loud, so showing the card to one
 * would leave the other guessing what just appeared. Who can answer is another
 * question, and the route answers it.
 *
 * The most recent, and only one: a weekend of rehearsals leaves suspended runs
 * behind, and picking the oldest would show a question from an hour ago in the
 * middle of a conversation happening now.
 */
export async function openHouseholdProposal(): Promise<OpenProposal | null> {
  const workflow = mastra.getWorkflow("resolveConflict");

  const suspended = await workflow.listWorkflowRuns({ status: "suspended", page: 0, perPage: MAX_RUNS });

  // Newest first, walked in that order on purpose: the first valid one is the
  // right one and no more snapshots are read.
  for (const run of suspended.runs) {
    const open = await readSuspension(run.runId);

    if (open) return open;
  }

  return null;
}
