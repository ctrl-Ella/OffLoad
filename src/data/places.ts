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
 *
 * The first eight are the household's own places, the ones the interpreter's
 * prompt names — "tiene piscina" happens at the Piscina, "recoger al niño" at
 * the Colegio — and two of their distances are not decorative: Elvia's work
 * and the pool are at opposite ends of the city, more than nine kilometres at
 * city speed, so that leaving at 18:30 does not reach 19:00. With the two
 * close together Mia would detect nothing and the scene would not exist.
 */

export type Place = {
  /** As written in Google Calendar's location field. */
  name: string;
  coordinates: Coordinates;
};

export const PLACES: readonly Place[] = [
  { name: "Casa", coordinates: { lat: 41.4036, lon: 2.156 } },
  { name: "Colegio", coordinates: { lat: 41.4058, lon: 2.1601 } },
  // Zona Franca, to the south-west.
  { name: "Trabajo de Elvia", coordinates: { lat: 41.352, lon: 2.133 } },
  // Poblenou, to the east.
  { name: "Trabajo de Carlos", coordinates: { lat: 41.404, lon: 2.199 } },
  // Nou Barris, to the north: the far end from Zona Franca.
  { name: "Piscina", coordinates: { lat: 41.44, lon: 2.178 } },
  { name: "Biblioteca", coordinates: { lat: 41.4021, lon: 2.1553 } },
  { name: "Supermercado", coordinates: { lat: 41.4004, lon: 2.1541 } },
  { name: "Gimnasio", coordinates: { lat: 41.393, lon: 2.164 } },
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
