import { NextResponse } from "next/server";
import { log, reason } from "@/lib/log";
import { currentPerson } from "@/lib/session";
import { openHouseholdProposal } from "@/mastra/workflows/proposals";

/**
 * What Mia has to say right now, for whoever is in the room. Both core people
 * receive the same, because they look at the same screen. `recipientName`
 * goes out and `recipientId` does not: without the name the screen cannot
 * say who was asked, which is what keeps the card from looking addressed to
 * whoever reads it. The identifier paints nothing.
 *
 * `asksToCall` says which of the run's two questions this is, as a fact the
 * screen can act on: a yes to this one is followed by choosing whom, and the
 * screen must not learn that from a button's wording.
 */

/** The step that asks whether to call the network. Has to match the workflow's. */
const ASKS_TO_CALL = "askWhetherToCall";

export async function GET() {
  const person = await currentPerson();

  if (!person) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  if (person.circle !== "CORE") {
    return NextResponse.json({ error: "this room is not yours" }, { status: 403 });
  }

  try {
    const open = await openHouseholdProposal();

    return NextResponse.json(
      {
        proposal: open && {
          runId: open.runId,
          question: open.question,
          detail: open.detail,
          yesLabel: open.yesLabel,
          noLabel: open.noLabel,
          recipientName: open.recipientName,
          forYou: open.recipientId === person.id,
          asksToCall: open.stepId === ASKS_TO_CALL,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    log.error("room: could not read the proposal", { personId: person.id, reason: reason(error) });

    return NextResponse.json({ error: "could not read" }, { status: 500 });
  }
}
