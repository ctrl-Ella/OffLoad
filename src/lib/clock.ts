/**
 * The household's clock. The container runs in UTC and does not get a vote:
 * from two in the morning in Madrid the server is already on another day,
 * which is why nothing here reads the process's own date.
 *
 * Pure on purpose, so the screens that only format a time do not drag the
 * database in behind a timezone string.
 */

export const ZONE = "Europe/Madrid";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in the household's zone, in the `YYYY-MM-DD` Google expects. */
export function todayInMadrid(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The household's offset ON THAT DAY, as `+02:00`, not today's. Written by
 * hand it works all summer and breaks on the last Sunday of October, when
 * nobody is looking.
 */
export function zoneOffset(day: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${day}T12:00:00Z`));

  const name = parts.find((part) => part.type === "timeZoneName")?.value;

  // Comes as `GMT+02:00`. In winter Madrid is `GMT` alone, with no offset written.
  return name?.replace("GMT", "") || "+00:00";
}

/**
 * The two instants a local day runs between. Computed through the zone and
 * not with a written `+02:00`: Madrid is `+01:00` half the year, and a fixed
 * offset would shift every winter day by an hour.
 */
export function dayRange(day: string): { from: Date; to: Date } {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, dayOfMonth);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guess));

  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  // What the zone's clock reads at the guessed instant, laid out as UTC: the
  // difference between the two is the zone's offset at that moment.
  const localAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );

  const from = new Date(guess - (localAsUtc - guess));

  return { from, to: new Date(from.getTime() + DAY_MS) };
}
