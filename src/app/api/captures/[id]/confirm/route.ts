import { NextResponse } from "next/server";
import { createEvent } from "@/lib/calendar";
import { confirmable } from "@/lib/captures";
import { db } from "@/lib/db";
import { accessToken } from "@/lib/google";
import { log, reason } from "@/lib/log";
import { currentPerson } from "@/lib/session";

/**
 * The yes. The only place in the application that creates a calendar event,
 * and it only runs because a person pressed something.
 *
 * What may and may not be written is decided in `captures.ts`, away from the
 * HTTP: rule 1 is a rule about a decision, not about a status code, and kept
 * in here it could only be checked by standing up a database, a session and a
 * Google account. This route does the three things that genuinely need the
 * outside world — look the capture up, call Google, record the id it gave.
 */

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const person = await currentPerson();

  if (!person) {
    return NextResponse.json({ error: "Nobody is signed in." }, { status: 401 });
  }

  const { id } = await params;

  const capture = await db.capture.findUnique({
    where: { id },
    select: {
      id: true,
      personId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      place: true,
      googleEventId: true,
    },
  });

  // A capture that does not exist and one belonging to somebody else answer
  // the same: otherwise this route tells whoever asks which ids are real.
  if (!capture) {
    return NextResponse.json({ error: "That is not yours to confirm." }, { status: 404 });
  }

  const decision = confirmable(capture, person.id);

  if (decision.verdict === "not-yours") {
    log.warn("confirm: a capture of someone else's was asked for", { personId: person.id });

    return NextResponse.json({ error: "That is not yours to confirm." }, { status: 404 });
  }

  if (decision.verdict === "no-time") {
    return NextResponse.json(
      { error: "Nobody said when that is, so there is no time to write." },
      { status: 409 },
    );
  }

  // Already written. The event exists, so this answers with it rather than
  // booking the same afternoon a second time.
  if (decision.verdict === "already-on-the-calendar") {
    return NextResponse.json({ googleEventId: decision.googleEventId });
  }

  const account = await db.googleAccount.findUnique({
    where: { personId: person.id },
    select: { refreshToken: true },
  });

  if (!account) {
    return NextResponse.json(
      { error: "There is no Google calendar connected to write to." },
      { status: 409 },
    );
  }

  let googleEventId: string;

  try {
    googleEventId = await createEvent(await accessToken(account.refreshToken), decision.event);
  } catch (error) {
    // `invalid_grant` is Google refusing to renew the permission: revoked, or
    // expired after a week while the app is in testing. Retrying does nothing
    // and connecting again does, so the two are told apart here exactly as
    // `schedule.ts` tells them apart when reading.
    const expired = reason(error).includes("invalid_grant");

    // No title and no time: this is someone's family calendar and this is a log.
    log.error(expired ? "confirm: the Google grant expired" : "confirm: Google did not write it", {
      personId: person.id,
      captureId: capture.id,
      reason: reason(error),
    });

    return NextResponse.json(
      {
        error: expired
          ? "Google needs connecting again before anything can be written."
          : "Google did not take it.",
        expired,
      },
      { status: expired ? 409 : 502 },
    );
  }

  // Written to the calendar and recorded here in the same breath. While this
  // column is empty the interface says the capture is on no calendar, and from
  // now on it is not empty, which is what makes a second press idempotent and
  // what takes the pending mark off it on the home screen.
  await db.capture.update({ where: { id: capture.id }, data: { googleEventId } });

  log.info("confirm: written to the calendar", { personId: person.id, captureId: capture.id });

  return NextResponse.json({ googleEventId });
}
