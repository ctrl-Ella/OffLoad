import { after, NextResponse } from "next/server";
import { requireVideoCredentials } from "@/lib/env";
import { log, reason } from "@/lib/log";
import { householdRoom } from "@/lib/room";
import { currentPerson } from "@/lib/session";
import { sessionToken, startCaptions } from "@/lib/video";

/**
 * The key to the room, for whoever is already in the house.
 *
 * The private key never leaves here: the browser gets a temporary token,
 * signed for this session and this role. The support network does not enter,
 * and it is not a permission check for caution's sake: it is the difference
 * between the two circles. Nicolás is reached by phone, and that is another
 * door.
 */

export async function GET() {
  const person = await currentPerson();

  if (!person) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  if (person.circle !== "CORE") {
    return NextResponse.json({ error: "this room is not yours" }, { status: 403 });
  }

  let applicationId: string;

  try {
    ({ applicationId } = requireVideoCredentials());
  } catch (error) {
    log.error("room: missing configuration", { reason: reason(error) });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vonage is not configured" },
      { status: 503 },
    );
  }

  try {
    const sessionId = await householdRoom();

    // Captions are switched on here, when the key is handed over: the one
    // moment it is known that someone is about to enter. Twice does no harm —
    // the second time Vonage answers they were already on — and it runs in
    // `after()` so joining does not wait for it.
    after(() => startCaptions(sessionId));

    log.info("room: key handed over", { personId: person.id });

    return NextResponse.json(
      { applicationId, sessionId, token: sessionToken(sessionId) },
      // The key expires in an hour, and a copy kept by the browser would be
      // one key too many lying around.
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    log.error("room: could not open", { personId: person.id, reason: reason(error) });

    return NextResponse.json({ error: "could not open the room" }, { status: 502 });
  }
}
