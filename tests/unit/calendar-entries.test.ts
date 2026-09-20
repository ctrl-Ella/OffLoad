import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calendarEntries, calendarStatuses } from "../../src/lib/calendar-entries.ts";
import type { Lane } from "../../src/lib/schedule.ts";

/** A lane as `coreRange` builds it, with Madrid summer times. */
function lane(name: string, status: Lane["status"], stops: Lane["stops"], conflicts: Lane["conflicts"] = []): Lane {
  return { personId: name.toLowerCase(), name, stops, conflicts, pending: new Set(), status };
}

const WORK = {
  id: "work",
  personId: "elvia",
  title: "Trabajo",
  startsAt: new Date("2026-09-21T09:00:00+02:00"),
  endsAt: new Date("2026-09-21T17:00:00+02:00"),
  place: null,
};

const PHYSIO = {
  id: "physio",
  personId: "elvia",
  title: "Fisioterapia",
  startsAt: new Date("2026-09-21T18:30:00+02:00"),
  endsAt: new Date("2026-09-21T19:30:00+02:00"),
  place: null,
};

describe("the entries the home calendar paints", () => {
  it("carry the date and the time in the household's zone, whatever the server's", () => {
    const [entry] = calendarEntries([lane("Elvia", "ready", [WORK])]);

    assert.equal(entry.date, "2026-09-21");
    assert.equal(entry.time, "09:00");
    assert.equal(entry.endTime, "17:00");
    assert.equal(entry.person, "Elvia");
  });

  it("mark the two stops of a clash, and nothing else", () => {
    const entries = calendarEntries([
      lane("Elvia", "ready", [WORK, PHYSIO], [
        { reason: "overlap", previous: WORK, next: PHYSIO, gapMin: -10, travelMin: null },
      ]),
    ]);

    assert.deepEqual(entries.map((entry) => entry.clash), [true, true]);
  });

  it("come out in time order across both people", () => {
    const entries = calendarEntries([
      lane("Elvia", "ready", [PHYSIO]),
      lane("Carlos", "ready", [{ ...WORK, id: "carlos-work", personId: "carlos" }]),
    ]);

    assert.deepEqual(entries.map((entry) => `${entry.time} ${entry.person}`), ["09:00 Carlos", "18:30 Elvia"]);
  });

  it("say whose calendar could not be read instead of showing it empty", () => {
    const statuses = calendarStatuses([lane("Elvia", "unavailable", []), lane("Carlos", "no-google", [])]);

    assert.deepEqual(statuses, [
      { person: "Elvia", status: "unavailable" },
      { person: "Carlos", status: "no-google" },
    ]);
  });
});
