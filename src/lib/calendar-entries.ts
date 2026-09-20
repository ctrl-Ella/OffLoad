// With the extension, so Node can run the unit test outside Next.
import { ZONE } from "./clock.ts";
import type { Lane } from "./schedule.ts";

/**
 * What the home screen's calendar paints: one entry per stop, already
 * formatted, with whose it is and whether it is part of a clash. Pure, so the
 * client component receives strings and never a `Date`, which does not
 * survive the trip to the browser as itself.
 */

export type CalendarEntry = {
  /** `YYYY-MM-DD` in the household's zone. What the day picker matches on. */
  date: string;
  /** `HH:MM`, same zone. */
  time: string;
  endTime: string;
  title: string;
  /** Whose calendar it comes from. */
  person: string;
  /** Not on any calendar yet: something told to Mia and not confirmed. */
  pending: boolean;
  /** Part of a clash this person cannot make. */
  clash: boolean;
};

/** Which calendars could be read, so the screen says whose it is showing. */
export type CalendarStatus = { person: string; status: Lane["status"] };

const DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

export function calendarEntries(lanes: Lane[]): CalendarEntry[] {
  return lanes
    .flatMap((lane) => {
      const clashing = new Set(
        lane.conflicts.flatMap((conflict) => [conflict.previous.id, conflict.next.id]),
      );

      return lane.stops.map((stop) => ({
        date: DATE.format(stop.startsAt),
        time: TIME.format(stop.startsAt),
        endTime: TIME.format(stop.endsAt),
        title: stop.title,
        person: lane.name,
        pending: lane.pending.has(stop.id),
        clash: clashing.has(stop.id),
      }));
    })
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export function calendarStatuses(lanes: Lane[]): CalendarStatus[] {
  return lanes.map((lane) => ({ person: lane.name, status: lane.status }));
}
