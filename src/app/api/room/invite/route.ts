import { after, NextResponse } from "next/server";
import { z } from "zod";
import { supportNetwork } from "@/lib/household";
import { inviteToCall } from "@/lib/invite";
import { log, reason } from "@/lib/log";
import { openRoom } from "@/lib/room";
import { currentPerson } from "@/lib/session";

/**
 * Choosing whom to call, from the screen.
 *
 * The other door into `inviteToCall`: `/api/room/heard` opens it on a spoken
 * "invita a Rosa", this one on a pressed name after Mia asked «¿Llamo a
 * alguno?» and someone said yes. Both end in the same text and the same
 * "invite" signal, so the room confirms both the same way.
 *
 * `GET` lists who can be chosen, names and identifiers only: the number stays
 * on the server, where the text is sent from. Rule 3 holds by omission —
 * nothing here says whether any of them is free, because nothing here knows.
 */

const requestSchema = z.object({
  personId: z.string().min(1).describe("Who to text, from the list GET hands out"),
});

export async function GET() {
  const person = await currentPerson();

  if (!person) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  if (person.circle !== "CORE") {
    return NextResponse.json({ error: "this room is not yours" }, { status: 403 });
  }

  try {
    const network = await supportNetwork();

    return NextResponse.json(
      { network: network.map(({ id, name }) => ({ id, name })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    log.error("invite: could not read the support network", { personId: person.id, reason: reason(error) });

    return NextResponse.json({ error: "could not read" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const person = await currentPerson();

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

  try {
    const sessionId = await openRoom();

    // Without a room there is no link to text: the guest's key is tied to
    // the session it was signed for.
    if (!sessionId) {
      return NextResponse.json({ error: "there is no call to invite them to" }, { status: 409 });
    }

    const invited = (await supportNetwork()).find(({ id }) => id === validated.data.personId);

    // The core is not on this list, and that is the point: the room already
    // reaches them, and a text would be a second door into the household.
    if (!invited) {
      return NextResponse.json({ error: "nobody in the support network has that id" }, { status: 404 });
    }

    log.info("invite: chosen from the screen", { personId: person.id, invitedId: invited.id });

    // The outcome reaches both screens as the "invite" signal, once Vonage
    // has answered: this route says only that the text is on its way.
    after(() => inviteToCall(sessionId, invited));

    return NextResponse.json({ status: "inviting" }, { status: 202 });
  } catch (error) {
    log.error("invite: could not invite", { personId: person.id, reason: reason(error) });

    return NextResponse.json({ error: "could not invite" }, { status: 500 });
  }
}
