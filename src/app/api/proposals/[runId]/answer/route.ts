import { after, NextResponse } from "next/server";
import { z } from "zod";
import { log, reason } from "@/lib/log";
import { notifyRoom } from "@/lib/room";
import { currentPerson } from "@/lib/session";
import { mastra } from "@/mastra";
import { proposalOf } from "@/mastra/workflows/proposals";

/**
 * Answering Mia. It resumes the run at the exact step it stopped.
 *
 * Who answers is decided by the session, not the body: the body brings a
 * boolean and nothing else. The step it resumes by comes from the snapshot,
 * not a constant, so this route serves both questions of the run without
 * knowing which one is being answered.
 */

const requestSchema = z.object({ accepts: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const person = await currentPerson();

  if (!person) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { runId } = await params;

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

  const proposal = await proposalOf(runId);

  if (!proposal) {
    // Same for a run that does not exist and one no longer waiting: from
    // outside they are the same, and telling them apart would say whether
    // that run exists.
    return NextResponse.json({ error: "that question is no longer open" }, { status: 409 });
  }

  // Anyone in the core answers, not only the card's recipient. Decided on
  // 2026-09-18, when the negotiation moved into the video call: inside it
  // both have talked it through aloud before pressing, so demanding one
  // specific person press means passing the laptop over.
  //
  // Deliberate technical debt: this also relaxes the route outside the call,
  // and the card's recipient no longer decides anything. What holds the
  // authorisation now is the circle, which still keeps the support network
  // out. Limiting it to an open room is what is missing.
  if (person.circle !== "CORE") {
    log.warn("proposals: someone outside the core tried to answer", { runId, personId: person.id });

    return NextResponse.json({ error: "that question is not for you" }, { status: 403 });
  }

  const { accepts } = validated.data;

  log.info("proposals: answered", {
    runId,
    personId: person.id,
    theirs: proposal.recipientId === person.id,
    accepts,
  });

  after(async () => {
    try {
      const workflow = mastra.getWorkflow("resolveConflict");
      const run = await workflow.createRun({ runId });

      const result = await run.resume({ step: proposal.stepId, resumeData: { accepts } });

      log.info("workflow: resumed", { runId, step: proposal.stepId, status: result.status });

      // Notified whatever happened: if the run suspended again there is a new
      // question to show, and if it finished there is a card to remove from
      // both screens. Both are "look again".
      await notifyRoom(runId);
    } catch (error) {
      // Two presses in a row land here: the second finds the run already claimed.
      log.warn("workflow: could not resume", { runId, step: proposal.stepId, reason: reason(error) });
    }
  });

  return NextResponse.json({ runId, status: "resuming" }, { status: 202 });
}
