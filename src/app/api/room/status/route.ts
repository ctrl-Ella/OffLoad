import { NextResponse } from "next/server";
import { otherCorePerson } from "@/lib/household";
import { log, reason } from "@/lib/log";
import { openRoom } from "@/lib/room";
import { currentPerson } from "@/lib/session";
import { anyoneInRoom } from "@/lib/video";

/**
 * Is there a call right now? What the home screen polls.
 *
 * It does not create the room, it only looks: otherwise the first person to
 * open the home screen would set up a room nobody asked for, and whoever is
 * waiting for a notice would end up opening the call themselves.
 *
 * Who is inside is deduced, not stored: the core is two people, so if someone
 * is publishing and it is not you, it is the other one.
 */

export async function GET() {
  const person = await currentPerson();

  if (!person) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  // The support network is not offered a way in. "No call" rather than a 403,
  // because from their side it is true: there is none they could join.
  if (person.circle !== "CORE") {
    return NextResponse.json({ inCall: false, who: null });
  }

  try {
    const sessionId = await openRoom();
    const inCall = sessionId ? await anyoneInRoom(sessionId) : false;

    return NextResponse.json(
      { inCall, who: inCall ? await otherCorePerson(person.id) : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    log.error("room: could not read the status", { personId: person.id, reason: reason(error) });

    return NextResponse.json({ error: "could not look" }, { status: 500 });
  }
}
