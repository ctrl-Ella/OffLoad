// With the extension, so Node can run the guardrail test outside Next.
import type { NewEvent } from "./calendar.ts";

/**
 * What can be done with something Mia heard, decided apart from the request
 * that asks and from the Google call that carries it out.
 *
 * It lives on its own because rule 1 — nothing reaches a calendar without a
 * human yes — is a rule about a decision, not about an HTTP status. Kept
 * inside the route it could only be checked by standing up a database, a
 * session and a Google account, which is the kind of test nobody runs.
 */

/** A capture as this decision needs to see it. Narrower than the table row on
 *  purpose: nothing here depends on how it was said or which run it came from. */
export type StoredCapture = {
  id: string;
  personId: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  place: string | null;
  googleEventId: string | null;
};

/**
 * Four answers, and only one of them writes.
 *
 * `already-on-the-calendar` is not a refusal: the yes was given once and the
 * event exists, so the second press gets the first event's id instead of a
 * second event. Without it, a double tap or a reload would book the same
 * afternoon twice.
 */
export type Verdict =
  | { verdict: "write"; event: NewEvent }
  | { verdict: "already-on-the-calendar"; googleEventId: string }
  /** Someone asked to confirm a capture that is not theirs. */
  | { verdict: "not-yours" }
  /** Nobody said when. There is no hour to invent one from, and inventing one
   *  is rule 4: announcing something that is not true yet. */
  | { verdict: "no-time" };

/**
 * Whether this capture can go on this person's calendar, and as what.
 *
 * The order matters: ownership is checked before anything else is revealed,
 * so asking about someone else's capture cannot be used to find out whether
 * it exists or whether it is already booked.
 */
export function confirmable(capture: StoredCapture, personId: string): Verdict {
  if (capture.personId !== personId) return { verdict: "not-yours" };

  if (capture.googleEventId) {
    return { verdict: "already-on-the-calendar", googleEventId: capture.googleEventId };
  }

  if (!capture.startsAt || !capture.endsAt) return { verdict: "no-time" };

  return {
    verdict: "write",
    event: {
      title: capture.title,
      startsAt: capture.startsAt,
      endsAt: capture.endsAt,
      location: capture.place,
    },
  };
}

/**
 * Saying the same thing twice is normal and must not duplicate anything.
 * Equality is by title and start: two things with the same name at different
 * times are two different things, and two things with no time and the same
 * name are one.
 */
export function fingerprint(title: string, startsAt: Date | null): string {
  return `${title.toLowerCase()}|${startsAt?.toISOString() ?? ""}`;
}

/** Of what was just heard, the part that is not already saved. */
export function unseenAmong<T extends { title: string; startsAt: Date | null }>(
  fresh: T[],
  known: { title: string; startsAt: Date | null }[],
): T[] {
  const seen = new Set(known.map((capture) => fingerprint(capture.title, capture.startsAt)));

  return fresh.filter((capture) => !seen.has(fingerprint(capture.title, capture.startsAt)));
}
