import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLACES, findPlace } from "../../src/data/places.ts";
import { distanceKm } from "../../src/lib/conflicts.ts";

function coordinatesOf(name: string) {
  return PLACES.find((place) => place.name === name)?.coordinates;
}

describe("finding a place by what someone typed", () => {
  it("ignores case and accents", () => {
    assert.deepEqual(findPlace("clinica bonanova"), coordinatesOf("Clínica Bonanova"));
    assert.deepEqual(findPlace("  TALLER GRACIA "), coordinatesOf("Taller Gràcia"));
  });

  it("does not guess: an unknown place is null, not the nearest match", () => {
    assert.equal(findPlace("Mercadona"), null);
    assert.equal(findPlace("Clínica"), null);
    assert.equal(findPlace("Piscina del niño"), null);
    assert.equal(findPlace(null), null);
  });
});

describe("the two distances the demo scenes stand on", () => {
  it("Elvia's work and the pool are far: leaving at 18:30 does not make 19:00", () => {
    const km = distanceKm(coordinatesOf("Trabajo de Elvia")!, coordinatesOf("Piscina")!);

    // More than thirty minutes at 18 km/h is more than nine kilometres.
    assert.ok(km > 9, `${km.toFixed(1)} km is not far enough for the scene`);
  });

  it("the library and the supermarket are close: an errand fits between them", () => {
    const km = distanceKm(coordinatesOf("Biblioteca")!, coordinatesOf("Supermercado")!);

    assert.ok(km < 0.3, `${km.toFixed(2)} km is not close enough for the scene`);
  });
});
