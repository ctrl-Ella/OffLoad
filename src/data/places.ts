import type { Coordinates } from "@/lib/conflicts";

/**
 * The places in this family's week, with Barcelona coordinates.
 *
 * Versioned and not in the environment on purpose: it is not a secret, and it
 * has to be identical on every machine. A different coordinate on two laptops
 * changes what Mia detects, and then the demo comes out differently depending
 * on who shows it.
 *
 * Declared scenario data, not invented data creeping into production: the day
 * the family enters their real places, this is replaced by a table of theirs.
 * The names match the `place` field in `scripts/demo-calendar/events.ts`,
 * which is what ends up in the calendar's location field. Coordinates are
 * neighbourhood level, not door level: enough for a straight-line estimate
 * that is declared as one, and nothing here is precise enough to pretend
 * otherwise.
 *
 * "Mercadona" is not here on purpose: there are dozens in the city and picking
 * one would be guessing. Without coordinates no travel time is claimed, which
 * is the right answer for a place that could be anywhere.
 */

export type Place = {
  /** As written in Google Calendar's location field. */
  name: string;
  coordinates: Coordinates;
};

export const PLACES: readonly Place[] = [
  { name: "Carrer de Sants 42", coordinates: { lat: 41.376, lon: 2.142 } },
  { name: "Clínica Bonanova", coordinates: { lat: 41.406, lon: 2.129 } },
  { name: "Club Esportiu Sants", coordinates: { lat: 41.3745, lon: 2.128 } },
  { name: "Poble Sec", coordinates: { lat: 41.373, lon: 2.164 } },
  { name: "Taller Gràcia", coordinates: { lat: 41.403, lon: 2.156 } },
] as const;

/**
 * Finds a place by what someone typed into their calendar.
 *
 * Case and accents are ignored because `location` is free text a person
 * types. What it does NOT do is guess: no match returns `null`, and
 * `conflicts.ts` already knows that without coordinates nothing is claimed. A
 * fuzzy match here would end as an invented clash.
 */
export function findPlace(location: string | null): Coordinates | null {
  if (!location) return null;

  const wanted = normalise(location);

  return PLACES.find((place) => normalise(place.name) === wanted)?.coordinates ?? null;
}

function normalise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
