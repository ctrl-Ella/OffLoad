import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectConflicts } from "../../src/lib/conflicts.ts";
import {
  dehydrateConflict,
  dehydrateStop,
  hydrateStops,
  stopSchema,
  type SerialisedStop,
} from "../../src/mastra/workflows/schemas.ts";

/**
 * The date border, tested with the trip a run really makes. What breaks this
 * is not a badly written conversion: it is that the workflow's state goes
 * through `JSON.stringify` on suspend and `JSON.parse` on resume. So the same
 * round trip is made here instead of comparing objects by hand.
 */

const WORK: SerialisedStop = {
  id: "work",
  personId: "elvia",
  title: "Trabajo",
  startsAt: "2026-09-22T09:00:00+02:00",
  endsAt: "2026-09-22T18:30:00+02:00",
  place: { lat: 41.352, lon: 2.133 },
};

const POOL: SerialisedStop = {
  id: "pool",
  personId: "elvia",
  title: "Piscina del niño",
  startsAt: "2026-09-22T19:00:00+02:00",
  endsAt: "2026-09-22T20:00:00+02:00",
  place: { lat: 41.44, lon: 2.178 },
};

/** What happens to a run's state between suspending and resuming. */
function throughPostgres<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("a stop's schema", () => {
  it("accepts an ISO time with an offset", () => {
    assert.ok(stopSchema.safeParse(WORK).success);
  });

  it("rejects a time without an offset, which is the one that gets misread", () => {
    assert.equal(
      stopSchema.safeParse({ ...WORK, startsAt: "2026-09-22T09:00:00" }).success,
      false,
      "without an offset, 19:00 in Madrid reads as 19:00 UTC",
    );
  });

  it("accepts a missing place", () => {
    assert.ok(stopSchema.safeParse({ ...WORK, place: null }).success);
  });

  it("rejects an object missing a field", () => {
    const incomplete: Record<string, unknown> = { ...WORK };
    delete incomplete.title;

    assert.equal(stopSchema.safeParse(incomplete).success, false);
  });
});

describe("the round trip through Postgres", () => {
  it("a stop survives suspending and resuming", () => {
    const [out] = hydrateStops([WORK]);
    const back = hydrateStops([throughPostgres(dehydrateStop(out))])[0];

    assert.equal(back.startsAt.getTime(), out.startsAt.getTime());
    assert.equal(back.endsAt.getTime(), out.endsAt.getTime());
    assert.deepEqual(back.place, out.place);
    assert.equal(back.title, out.title);
  });

  it("a clash survives too, and still validates", () => {
    const [clash] = detectConflicts(hydrateStops([WORK, POOL]));

    assert.ok(clash, "work to the pool across the city in thirty minutes is a clash");

    const back = throughPostgres(dehydrateConflict(clash));

    assert.equal(back.reason, "no-time");
    assert.ok(stopSchema.safeParse(back.next).success);
    assert.equal(hydrateStops([back.next])[0].startsAt.getTime(), clash.next.startsAt.getTime());
  });
});
