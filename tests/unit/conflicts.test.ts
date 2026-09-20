import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  conflictsForOnePerson,
  detectConflicts,
  distanceKm,
  travelMin,
  type Stop,
} from "../../src/lib/conflicts.ts";

/**
 * The step that decides the most, tested for real. The data here is the
 * subject of the test, not filler: each scenario declares what day it
 * describes and what has to happen. Coordinates are Barcelona's, chosen so
 * the distances are round to check.
 */

const PLACA_CATALUNYA = { lat: 41.3874, lon: 2.1686 };
/** About 2.4 km from plaça Catalunya: eight minutes at 18 km/h. */
const SAGRADA_FAMILIA = { lat: 41.4036, lon: 2.1744 };
/** About 12 km: a good forty minutes. */
const BADALONA = { lat: 41.4502, lon: 2.247 };

function stop(
  id: string,
  from: string,
  to: string,
  place: Stop["place"] = PLACA_CATALUNYA,
  personId = "elvia",
): Stop {
  return {
    id,
    personId,
    title: id,
    startsAt: new Date(`2026-09-24T${from}:00+02:00`),
    endsAt: new Date(`2026-09-24T${to}:00+02:00`),
    place,
  };
}

describe("distance and travel", () => {
  it("the same point twice is at zero", () => {
    assert.equal(distanceKm(PLACA_CATALUNYA, PLACA_CATALUNYA), 0);
  });

  it("distance does not depend on the order", () => {
    const there = distanceKm(PLACA_CATALUNYA, BADALONA);
    const back = distanceKm(BADALONA, PLACA_CATALUNYA);

    assert.equal(there.toFixed(6), back.toFixed(6));
  });

  it("without coordinates no trip is estimated: null, not zero", () => {
    const noPlace = stop("call the plumber", "10:00", "10:15", null);
    const withPlace = stop("pool", "10:30", "11:30");

    assert.equal(travelMin(noPlace, withPlace), null);
  });

  it("rounds up, because falling short is promising too much", () => {
    const a = stop("a", "09:00", "10:00", PLACA_CATALUNYA);
    const b = stop("b", "10:00", "11:00", SAGRADA_FAMILIA);

    const minutes = travelMin(a, b);

    assert.ok(minutes !== null);
    assert.equal(minutes, Math.ceil(minutes));
    assert.ok(minutes > 0, "two different places are not zero minutes apart");
  });
});

describe("one person's day", () => {
  it("a day that fits gives no conflict", () => {
    const day = [
      stop("work", "09:00", "17:00"),
      stop("the boy's swimming", "19:00", "20:00", SAGRADA_FAMILIA),
    ];

    assert.deepEqual(conflictsForOnePerson(day), []);
  });

  it("two stops that overlap, and the gap comes out negative", () => {
    const day = [stop("meeting", "16:00", "17:30"), stop("pick up the boy", "17:00", "17:30")];

    const [conflict, ...rest] = conflictsForOnePerson(day);

    assert.equal(rest.length, 0);
    assert.equal(conflict.reason, "overlap");
    assert.equal(conflict.gapMin, -30);
  });

  it("back to back in time but far on the map: no time", () => {
    const day = [
      stop("work", "09:00", "17:00", PLACA_CATALUNYA),
      stop("pool", "17:05", "18:00", BADALONA),
    ];

    const [conflict] = conflictsForOnePerson(day);

    assert.equal(conflict.reason, "no-time");
    assert.equal(conflict.gapMin, 5);
    assert.ok(conflict.travelMin > 5);
  });

  it("the same gap in the same place does fit", () => {
    const day = [
      stop("meeting", "09:00", "17:00", PLACA_CATALUNYA),
      stop("another meeting", "17:05", "18:00", PLACA_CATALUNYA),
    ];

    assert.deepEqual(conflictsForOnePerson(day), []);
  });

  it("a short gap between two unknown places claims nothing", () => {
    const day = [stop("errand", "09:00", "10:00", null), stop("call", "10:02", "10:30", null)];

    assert.deepEqual(conflictsForOnePerson(day), []);
  });

  it("only consecutive stops are compared: three in a row are two problems, not three pairs", () => {
    const day = [
      stop("a", "09:00", "10:00"),
      stop("b", "09:30", "10:30"),
      stop("c", "10:00", "11:00"),
    ];

    assert.equal(conflictsForOnePerson(day).length, 2);
  });
});

describe("the whole core circle", () => {
  it("two people in two places at the same time is a family, not a conflict", () => {
    const day = [
      stop("elvia at work", "09:00", "17:00", PLACA_CATALUNYA, "elvia"),
      stop("carlos at work", "09:00", "17:00", BADALONA, "carlos"),
    ];

    assert.deepEqual(detectConflicts(day), []);
  });

  it("each person's clashes are found on their own and come out in time order", () => {
    const day = [
      stop("carlos dinner", "20:00", "22:00", PLACA_CATALUNYA, "carlos"),
      stop("carlos late meeting", "21:00", "21:30", PLACA_CATALUNYA, "carlos"),
      stop("elvia work", "09:00", "17:00", PLACA_CATALUNYA, "elvia"),
      stop("elvia pool", "17:05", "18:00", BADALONA, "elvia"),
    ];

    const conflicts = detectConflicts(day);

    assert.equal(conflicts.length, 2);
    assert.equal(conflicts[0].next.title, "elvia pool");
    assert.equal(conflicts[1].next.title, "carlos late meeting");
  });
});
