/**
 * Telling that two stops clash is arithmetic, and no language model is asked.
 *
 * Everything here is pure: same input, same output, no network, no clock, no
 * database. That is what makes it the one step of the run that can be tested
 * for real. The reasoning is in docs/specs/0005-conflict-screen-and-call.md.
 */

export type Coordinates = { lat: number; lon: number };

/**
 * Somewhere someone has to be, between two times.
 *
 * `place` can be missing: a phone call or an errand has no coordinates, and a
 * gap there is not an error. It means no travel time can be computed, which
 * has to be said rather than made up.
 */
export type Stop = {
  id: string;
  personId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  place: Coordinates | null;
};

/**
 * Why two stops do not fit in the same person's day.
 *
 * `overlap` is exact arithmetic. `no-time` carries a travel estimate inside,
 * and that is why they are two shapes and not a flag: one is a fact and the
 * other a calculation with assumptions, and rule 6 asks to tell which is which.
 * On `no-time` the travel figure is never null, because without it nothing
 * would have been claimed.
 */
export type Conflict =
  | {
      reason: "overlap";
      previous: Stop;
      next: Stop;
      /** Minutes between the end of one and the start of the other. Negative here. */
      gapMin: number;
      travelMin: number | null;
    }
  | {
      reason: "no-time";
      previous: Stop;
      next: Stop;
      gapMin: number;
      /** Minutes of travel, estimated in a straight line. */
      travelMin: number;
    };

/**
 * City average, door to door. Not a car's speed: what comes out of adding
 * parking, traffic lights and the last stretch on foot. Still an estimate,
 * and whoever shows it says so.
 */
const CITY_KMH = 18;

const EARTH_RADIUS_KM = 6371;
const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Straight-line distance between two points, by the haversine formula. Not by
 * road: there is no routing service here, and paying a dependency and a
 * network hop to refine a figure that is declared an estimate anyway buys
 * nothing.
 */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Minutes it takes between two stops, estimated. `null` when either has no
 * coordinates: returning zero there would say you arrive with time to spare,
 * which is the opposite of what is known.
 */
export function travelMin(a: Stop, b: Stop): number | null {
  if (!a.place || !b.place) return null;

  const minutes = (distanceKm(a.place, b.place) / CITY_KMH) * MINUTES_PER_HOUR;

  // Rounded up: falling short on a trip is telling someone they arrive when
  // they do not.
  return Math.ceil(minutes);
}

function gapMin(previous: Stop, next: Stop): number {
  return (next.startsAt.getTime() - previous.endsAt.getTime()) / MS_PER_MINUTE;
}

/**
 * One person's clashes for the day.
 *
 * Only consecutive stops are compared after sorting, not every pair: if A
 * clashes with B and B with C, what someone needs to hear is two problems in
 * a row, not three pairs.
 *
 * Proximity is measured between stops, never between people. That is rule 5,
 * and here it is literal: nobody's location exists in this function, only the
 * places they have to go.
 */
export function conflictsForOnePerson(stops: Stop[]): Conflict[] {
  const sorted = [...stops].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const conflicts: Conflict[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const previous = sorted[i];
    const next = sorted[i + 1];

    const gap = gapMin(previous, next);
    const travel = travelMin(previous, next);

    if (gap < 0) {
      conflicts.push({ reason: "overlap", previous, next, gapMin: gap, travelMin: travel });
      continue;
    }

    // Without a computable trip nothing is claimed: a short gap between two
    // unknown places may be fine or not, and calling it a clash would be
    // inventing a fact.
    if (travel !== null && gap < travel) {
      conflicts.push({ reason: "no-time", previous, next, gapMin: gap, travelMin: travel });
    }
  }

  return conflicts;
}

/**
 * The whole core circle's clashes, each person's day looked at on its own.
 *
 * Two people in two places at the same time is NOT a conflict: it is a
 * family. The conflict is one person having to be in two places.
 */
export function detectConflicts(stops: Stop[]): Conflict[] {
  const byPerson = new Map<string, Stop[]>();

  for (const stop of stops) {
    const theirs = byPerson.get(stop.personId);
    if (theirs) theirs.push(stop);
    else byPerson.set(stop.personId, [stop]);
  }

  return [...byPerson.values()]
    .flatMap(conflictsForOnePerson)
    .sort((a, b) => a.next.startsAt.getTime() - b.next.startsAt.getTime());
}
