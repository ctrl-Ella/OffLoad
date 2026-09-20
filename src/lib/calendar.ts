/**
 * Google Calendar. Still no `googleapis`: it is a couple of requests and the
 * package is several megabytes. The border with `google.ts` holds — there the
 * permission, here what is done with it.
 *
 * Nothing here leaves the server. The access token lives as long as one
 * request; `accessToken()` in `google.ts` is where it comes from.
 *
 * Spec 0004 kept the Calendar calls inside the demo script because they had
 * one caller. The conflict screen is the second, and reading a day is the one
 * call they share, so that call moves here and the script keeps its own
 * writes.
 */

import { ZONE } from "@/lib/clock";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const CALENDAR = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * An event as Google returns it, with what matters here.
 *
 * `location` is free text a person wrote: it can be missing, misspelt, and it
 * is not a coordinate. Matching it against the places table is the job of
 * whoever turns it into a `Stop`, not of this module.
 */
export type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  /**
   * `null` on all-day events. Google returns those with `date` instead of
   * `dateTime`, and an event with no time cannot clash with another by the
   * minute. They are marked rather than given an invented start, which is
   * what would make Mia see clashes that are not there.
   */
  startsAt: Date | null;
  endsAt: Date | null;
};

type GoogleDate = { dateTime?: string; date?: string };

type RawEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: GoogleDate;
  end?: GoogleDate;
};

function toDate(edge: GoogleDate | undefined): Date | null {
  if (!edge?.dateTime) return null;

  const date = new Date(edge.dateTime);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** The events between two instants, series expanded into their instances. */
export async function eventsBetween(
  accessToken: string,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    // A "every Tuesday" has to show up as the Tuesday it is, or it clashes
    // with nothing.
    singleEvents: "true",
    orderBy: "startTime",
    // Enough for the three weeks the home screen browses; a day needs far less.
    maxResults: "250",
  });

  const response = await fetch(`${CALENDAR}?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google did not return the calendar: ${response.status}`);
  }

  const { items = [] } = (await response.json()) as { items?: RawEvent[] };

  return (
    items
      // A cancelled event still comes back and occupies nobody's day.
      .filter((event) => event.status !== "cancelled" && event.id)
      .map((event) => ({
        id: event.id as string,
        title: event.summary ?? "(sin título)",
        location: event.location ?? null,
        startsAt: toDate(event.start),
        endsAt: toDate(event.end),
      }))
  );
}

/** What it takes to put something on a calendar. A `Capture` with both edges
 *  filled in is already this shape. */
export type NewEvent = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** Free text, as a person wrote it. Google shows it and geocodes nothing. */
  location?: string | null;
};

/**
 * Creates the event and returns the id Google gave it. The caller stores that
 * id: it is what says this was confirmed, and what makes confirming it twice
 * answerable without writing it twice.
 *
 * `dateTime` carries its own offset, so the instant is unambiguous whatever
 * the container's clock reads. `timeZone` goes alongside it for the event's
 * own zone, which is what decides where it lands if someone travels.
 */
export async function createEvent(accessToken: string, event: NewEvent): Promise<string> {
  const response = await fetchWithTimeout(CALENDAR, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.title,
      location: event.location ?? undefined,
      start: { dateTime: event.startsAt.toISOString(), timeZone: ZONE },
      end: { dateTime: event.endsAt.toISOString(), timeZone: ZONE },
    }),
  });

  if (!response.ok) {
    throw new Error(`Google did not create the event: ${response.status}`);
  }

  const { id } = (await response.json()) as { id?: string };

  // Without the id there is no telling later whether this was written, and the
  // next confirmation would write it again. A 200 with no id is a failure here.
  if (!id) throw new Error("Google created the event and returned no id.");

  return id;
}
