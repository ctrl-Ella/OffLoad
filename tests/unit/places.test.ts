import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLACES, findPlace } from "../../src/data/places.ts";

describe("finding a place by what someone typed", () => {
  it("ignores case and accents", () => {
    assert.deepEqual(findPlace("clinica bonanova"), PLACES[1].coordinates);
    assert.deepEqual(findPlace("  TALLER GRACIA "), PLACES[4].coordinates);
  });

  it("does not guess: an unknown place is null, not the nearest match", () => {
    assert.equal(findPlace("Mercadona"), null);
    assert.equal(findPlace("Clínica"), null);
    assert.equal(findPlace(null), null);
  });
});
