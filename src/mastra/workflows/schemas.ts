import { z } from "zod";
import type { Conflict, Stop } from "@/lib/conflicts";

/**
 * The border between the dates that travel and the dates that compute.
 *
 * A run's state is stored in Postgres as JSON, and a `Date` does not survive
 * that trip: it leaves as a string and comes back as a string. A step that
 * suspends waiting for a person can resume hours later, in another process,
 * and there `startsAt.getTime` no longer exists. So inside the workflow times
 * are ISO text, `conflicts.ts` keeps working with `Date` — which is what
 * makes it pure and testable — and these functions are the only place the
 * line is crossed.
 */

/** A time with its offset, like `2026-09-22T18:30:00+02:00`. */
const instant = z.iso.datetime({ offset: true });

export const coordinatesSchema = z.object({
  lat: z.number().describe("Latitude in decimal degrees"),
  lon: z.number().describe("Longitude in decimal degrees"),
});

export const stopSchema = z.object({
  id: z.string().describe("The event's identifier in its source calendar"),
  personId: z.string().describe("Who has to be there"),
  title: z.string().describe("What it is called in their calendar"),
  startsAt: instant.describe("When it starts, ISO 8601 with offset"),
  endsAt: instant.describe("When it ends, ISO 8601 with offset"),
  place: coordinatesSchema
    .nullable()
    .describe("Where. Null when it could not be located, and then no trip is claimed"),
});

export type SerialisedStop = z.infer<typeof stopSchema>;

export const conflictSchema = z.object({
  reason: z
    .enum(["overlap", "no-time"])
    .describe("`overlap` is an exact fact; `no-time` carries an estimate inside"),
  previous: stopSchema.describe("The stop that has to be left"),
  next: stopSchema.describe("The stop that is not reached"),
  gapMin: z.number().describe("Minutes between the end of one and the start of the other. Negative if they overlap"),
  travelMin: z.number().nullable().describe("Estimated minutes of travel. Null when a coordinate is missing"),
});

export type SerialisedConflict = z.infer<typeof conflictSchema>;

/** From what travels to what computes. */
export function hydrateStops(stops: SerialisedStop[]): Stop[] {
  return stops.map((stop) => ({
    ...stop,
    startsAt: new Date(stop.startsAt),
    endsAt: new Date(stop.endsAt),
  }));
}

/** From what computes to what travels. */
export function dehydrateStop(stop: Stop): SerialisedStop {
  return { ...stop, startsAt: stop.startsAt.toISOString(), endsAt: stop.endsAt.toISOString() };
}

export function dehydrateConflict(conflict: Conflict): SerialisedConflict {
  return {
    ...conflict,
    previous: dehydrateStop(conflict.previous),
    next: dehydrateStop(conflict.next),
  };
}

/**
 * What whoever has to answer sees. It is the `suspendPayload` of step 5.
 *
 * It carries only what is painted, and that is deliberate: a suspended run
 * can be read by another person's screen, so putting the whole case file here
 * would hand out the household's calendars for convenience.
 *
 * Its shape is hard to change and worth knowing before touching: it is
 * serialised inside the run's snapshot in Postgres, and changing a field
 * leaves the runs suspended at that moment unreadable. The button labels
 * travel because the two cards do not ask the same thing — "Voy yo" is not
 * "Llama" — and this way the component does not have to know which it paints.
 */
export const cardSchema = z.object({
  recipientId: z.string().describe("Who has to be asked. Comes from the database"),
  recipientName: z.string().describe("Their name, for the greeting"),
  question: z.string().describe("What Mia says, already worded"),
  detail: z.string().describe("The slot and the place, on one line"),
  yesLabel: z.string().describe("What the accepting button says. It names the action, not «Sí»"),
  noLabel: z.string().describe("What the declining button says"),
});

export type Card = z.infer<typeof cardSchema>;

/**
 * What whoever answers sends back: a boolean and nothing else. Who answers
 * does not travel here: the route knows it from the session. If it travelled
 * in the body, anyone could answer for someone else by changing a value.
 */
export const answerSchema = z.object({
  accepts: z.boolean().describe("Whether they accept what Mia proposed"),
});
