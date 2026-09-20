import { NextResponse } from "next/server";
import { log, reason } from "@/lib/log";
import { currentPerson } from "@/lib/session";
import { synthesise } from "@/lib/slng";
import { openHouseholdProposal } from "@/mastra/workflows/proposals";

/**
 * Mia's voice: the clip of what she has to say right now.
 *
 * It takes no text, it looks it up. Two reasons and both matter: whose turn
 * it is is decided by the run, so the sentence comes from the run and not
 * from whatever a browser sends; and a synthesis route that takes free text
 * is an open relay to a paid API.
 *
 * Its own channel, deliberately: turning the call's sound off — what cuts the
 * echo with two devices on one table — does not silence Mia, because her
 * audio is not a Vonage stream but a clip from this route.
 */

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

    if (!open) {
      // With nothing to say nothing is synthesised. Rule 4 as a route: staying
      // quiet is a valid answer.
      return NextResponse.json({ error: "nothing to say" }, { status: 404 });
    }

    const audio = await synthesise(open.question);

    log.info("voice: Mia says her piece", { runId: open.runId, personId: person.id, bytes: audio.byteLength });

    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/wav",
        // Each proposal sounds once: caching would invite the browser to play
        // the previous one when the conversation moves on.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    log.error("voice: could not synthesise", { personId: person.id, reason: reason(error) });

    // 502 and not 500: SLNG failed, and the call stands with the buttons.
    return NextResponse.json({ error: "could not speak" }, { status: 502 });
  }
}
