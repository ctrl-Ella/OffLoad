import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGuestLinkSecret, requireVideoCredentials } from "@/lib/env";
import { verifyGuestLinkToken } from "@/lib/guest-link";
import { log, reason } from "@/lib/log";
import { openRoom } from "@/lib/room";
import { sessionToken } from "@/lib/video";

/**
 * The key to the room for whoever arrived by SMS, not by signing in.
 *
 * No cookie, no `currentPerson()`: the token itself is the credential, tied
 * to one specific person and one specific room by `verifyGuestLinkToken`.
 * Always a `publisher` — there is no reason for a guest to be a moderator,
 * and `startCaptions` was already switched on when the core opened the room.
 */

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let applicationId: string;
  let guestLinkSecret: string;

  try {
    guestLinkSecret = requireGuestLinkSecret();
    ({ applicationId } = requireVideoCredentials());
  } catch (error) {
    log.error("room: missing configuration", { reason: reason(error) });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vonage is not configured" },
      { status: 503 },
    );
  }

  const check = verifyGuestLinkToken(token, guestLinkSecret);

  if (!check.ok) {
    return NextResponse.json(
      {
        error:
          check.reason === "expired"
            ? "This link has expired. Ask them to invite you again."
            : "This link isn't valid.",
      },
      { status: check.reason === "expired" ? 410 : 400 },
    );
  }

  let person: { name: string; circle: string } | null;

  try {
    // The room the link names has to still be the household's current one: a
    // link survives the household re-creating its room in theory, and it
    // should not open whatever room happens to exist now.
    const currentRoom = await openRoom();

    if (currentRoom !== check.sessionId) {
      return NextResponse.json({ error: "This invitation is no longer open." }, { status: 404 });
    }

    person = await db.person.findUnique({
      where: { id: check.personId },
      select: { name: true, circle: true },
    });
  } catch (error) {
    log.error("room: could not check the guest link", { reason: reason(error) });

    return NextResponse.json({ error: "Could not open the room." }, { status: 502 });
  }

  // Also covers the household removing someone from the support network
  // after the SMS went out: a changed circle revokes the link without
  // needing to track it anywhere.
  if (!person || person.circle !== "SUPPORT") {
    return NextResponse.json({ error: "This invitation is no longer open." }, { status: 404 });
  }

  log.info("room: guest key handed over", { personId: check.personId });

  return NextResponse.json(
    {
      applicationId,
      sessionId: check.sessionId,
      token: sessionToken(check.sessionId, "publisher"),
      name: person.name,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
