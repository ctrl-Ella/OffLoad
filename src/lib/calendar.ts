/**
 * Reading Google Calendar. Still no `googleapis`: it is one request and the
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
    maxResults: "50",
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
