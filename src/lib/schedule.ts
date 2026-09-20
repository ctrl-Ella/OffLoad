import { findPlace } from "@/data/places";
import { eventsBetween, type CalendarEvent } from "@/lib/calendar";
import { dayRange, todayInMadrid } from "@/lib/clock";
import { detectConflicts, type Conflict, type Stop } from "@/lib/conflicts";
import { db } from "@/lib/db";
import { accessToken } from "@/lib/google";
import { log, reason } from "@/lib/log";

/**
 * A person's day, read from their Google and with the clashes already worked
 * out. It is the wire between three pieces that exist on their own:
 * `calendar.ts` reads, `places.ts` turns a typed location into coordinates,
 * and `conflicts.ts` says what does not fit. None of the three knows the
 * other two, and this is the only place they meet.
 */

/**
 * What the screen needs to know, including the cases where there is nothing
 * to show. States and not a `null` with a loose error because each one is
 * told differently: someone who has not connected Google has no problem, they
 * are missing a step; someone who has, and whose Google does not answer,
 * needs to hear that their calendar exists and cannot be seen today — not an
 * empty screen that looks like a free day.
 */
export type PersonDay =
  | { status: "no-google" }
  | { status: "unavailable" }
  | { status: "ready"; events: CalendarEvent[] };

/**
 * The events that can clash with another. All-day ones stay out: an event
 * with no time does not overlap anyone by the minute. The place can be
 * missing and that is fine: `conflicts.ts` expects it and estimates no trip.
 */
export function toStops(events: CalendarEvent[], personId: string): Stop[] {
  return events
    .filter((event) => event.startsAt !== null && event.endsAt !== null)
    .map((event) => ({
      id: event.id,
      personId,
      title: event.title,
      startsAt: event.startsAt as Date,
      endsAt: event.endsAt as Date,
      place: findPlace(event.location),
    }));
}

/**
 * One core person's day. A Google failure does not take the screen down: it
 * is logged with its reason and comes back as `unavailable`, which the screen
 * knows how to tell.
 */
export async function personDay(personId: string, day = todayInMadrid()): Promise<PersonDay> {
  const account = await db.googleAccount.findUnique({
    where: { personId },
    select: { refreshToken: true },
  });

  if (!account) return { status: "no-google" };

  try {
    const token = await accessToken(account.refreshToken);
    const { from, to } = dayRange(day);

    return { status: "ready", events: await eventsBetween(token, from, to) };
  } catch (error) {
    // No title and no place of any event: personal data, and this is a server log.
    log.warn("schedule: could not read the day", { personId, day, reason: reason(error) });

    return { status: "unavailable" };
  }
}

/** One core person's day, with their stops and their clashes. */
export type Lane = {
  personId: string;
  name: string;
  /** Empty when there is no Google, or when Google did not answer. */
  stops: Stop[];
  conflicts: Conflict[];
  /**
   * Which of those stops are on no calendar yet: what someone told Mia counts
   * for the arithmetic but is not written anywhere until confirmed. Painting
   * it like a Google event would say it is booked, and that is rule 4.
   */
  pending: Set<string>;
  /**
   * Whether this person's calendar could be read at all, and if not, why. An
   * empty lane and a lane that cannot be seen are different things: zero
   * stops because the day is free is not zero stops because Mia does not look
   * there, and confusing them is claiming an availability nobody knows.
   */
  status: PersonDay["status"];
};

/**
 * The day of one or all core people, one lane each.
 *
 * With `onlyFor` it returns that person's lane and nothing else, which is what
 * someone's own screen shows: Mia reads both calendars because she needs to
 * know whom to ask for what, but on one person's screen the other's day has
 * no business. Each lane is separate on purpose: a clash belongs to one person
 * — being in two places — and a line that mixed two would hint at clashes
 * where there is only a family spread out.
 */
export async function coreJourney(day = todayInMadrid(), onlyFor?: string): Promise<Lane[]> {
  const core = await db.person.findMany({
    where: onlyFor ? { id: onlyFor } : { circle: "CORE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const { from, to } = dayRange(day);

  return Promise.all(
    core.map(async (person) => {
      const theirDay = await personDay(person.id, day);

      if (theirDay.status !== "ready") {
        return {
          personId: person.id,
          name: person.name,
          stops: [],
          conflicts: [],
          pending: new Set<string>(),
          status: theirDay.status,
        };
      }

      // What this person told Mia and is not written yet. It counts even
      // though it is on no calendar: if Mia only read Google, what you just
      // said would never clash with anything.
      const captures = await db.capture.findMany({
        where: { personId: person.id, googleEventId: null, startsAt: { gte: from, lt: to } },
        select: { id: true, title: true, startsAt: true, endsAt: true, place: true },
      });

      const unwritten: Stop[] = captures
        .filter((capture) => capture.startsAt !== null && capture.endsAt !== null)
        .map((capture) => ({
          id: capture.id,
          personId: person.id,
          title: capture.title,
          startsAt: capture.startsAt as Date,
          endsAt: capture.endsAt as Date,
          place: findPlace(capture.place),
        }));

      const stops = [...toStops(theirDay.events, person.id), ...unwritten].sort(
        (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
      );

      return {
        personId: person.id,
        name: person.name,
        stops,
        conflicts: detectConflicts(stops),
        pending: new Set(unwritten.map((stop) => stop.id)),
        status: "ready",
      };
    }),
  );
}
