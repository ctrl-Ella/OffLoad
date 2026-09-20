import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  correctInventedAvailability,
  proposalSchema,
  type Proposal,
} from "../src/mastra/agents/support-network.ts";
import { confirmable, type StoredCapture } from "../src/lib/captures.ts";

/**
 * The product rules that do not bend, checked against the code that can
 * break them today. Rules 1 and 3 are here; the other four are still checked
 * by hand because no code capable of breaking them exists yet. A test written
 * against something not yet built checks nothing. They enter here as their
 * code appears.
 *
 * Each test carries the rule's name, so a failure says which principle broke
 * and not which function returned `undefined`.
 *
 *   npm run test:guardrails
 *
 * The names are the demo's and they are the subject of the test: the
 * difference between the core and the support network is exactly what is
 * being checked.
 */

const CORE = ["Elvia", "Carlos"];
const SUPPORT_NETWORK = ["Nicolás", "Abuela Rosa", "Vecina Marta"];

function proposal(decision: Proposal["decision"], person: string): Proposal {
  return { decision, person, reason: "the reason plays no part in this rule" };
}

describe("Rule 3 · nobody in the support network is ever described as available", () => {
  it("downgrades to «call» when the model proposes someone in the network", () => {
    // Exactly what a large model did in the benchmark on 2026-09-18: say the
    // grandmother was free without being able to know.
    const r = correctInventedAvailability(proposal("propose", "Abuela Rosa"), SUPPORT_NETWORK);

    assert.equal(r.proposal.decision, "call");
    assert.equal(r.inventedAvailability, true);
  });

  it("keeps the person and the reason when downgrading, because the choice was still good", () => {
    const r = correctInventedAvailability(proposal("propose", "Nicolás"), SUPPORT_NETWORK);

    assert.equal(r.proposal.person, "Nicolás");
    assert.equal(r.proposal.reason, "the reason plays no part in this rule");
  });

  it("does not touch a proposal to someone in the core, who has a calendar to look at", () => {
    const original = proposal("propose", "Carlos");
    const r = correctInventedAvailability(original, SUPPORT_NETWORK);

    assert.deepEqual(r.proposal, original);
    assert.equal(r.inventedAvailability, false);
  });

  it("does not touch a «call» to the network, which is the right decision", () => {
    const original = proposal("call", "Vecina Marta");
    const r = correctInventedAvailability(original, SUPPORT_NETWORK);

    assert.deepEqual(r.proposal, original);
    assert.equal(r.inventedAvailability, false);
  });

  it("does not touch a «no-way-out»", () => {
    const original = proposal("no-way-out", "nobody");

    assert.deepEqual(correctInventedAvailability(original, SUPPORT_NETWORK).proposal, original);
  });

  it("with no support network there is nothing to downgrade", () => {
    const original = proposal("propose", "Elvia");
    const r = correctInventedAvailability(original, []);

    assert.deepEqual(r.proposal, original);
    assert.equal(r.inventedAvailability, false);
  });
});

describe("Rule 3 · the schema does not let a person who does not exist be named", () => {
  it("accepts anyone in either circle and «nobody»", () => {
    const schema = proposalSchema(CORE, SUPPORT_NETWORK);

    for (const person of [...CORE, ...SUPPORT_NETWORK, "nobody"]) {
      assert.doesNotThrow(() => schema.parse({ decision: "call", person, reason: "exists" }));
    }
  });

  it("rejects an invented person before it reaches any screen", () => {
    const schema = proposalSchema(CORE, SUPPORT_NETWORK);

    assert.throws(() =>
      schema.parse({ decision: "propose", person: "Tía Manuela", reason: "this person is in no circle" }),
    );
  });
});

const ELVIA = "person_elvia";
const CARLOS = "person_carlos";

function capture(fields: Partial<StoredCapture> = {}): StoredCapture {
  return {
    id: "capture_1",
    personId: ELVIA,
    title: "Natación del niño",
    startsAt: new Date("2026-09-24T18:30:00+02:00"),
    endsAt: new Date("2026-09-24T19:30:00+02:00"),
    place: "Piscina",
    googleEventId: null,
    ...fields,
  };
}

describe("Rule 1 · nothing is ever written to a calendar without human confirmation", () => {
  it("a capture with a time and an owner is what a yes can write", () => {
    const decision = confirmable(capture(), ELVIA);

    assert.equal(decision.verdict, "write");
    assert.equal(decision.verdict === "write" && decision.event.title, "Natación del niño");
  });

  it("does not write somebody else's capture, whoever asks", () => {
    assert.equal(confirmable(capture(), CARLOS).verdict, "not-yours");
  });

  it("says nothing about somebody else's capture beyond refusing it", () => {
    // Already booked and not theirs: the answer is the same as for any capture
    // of someone else's, so asking cannot be used to find out what exists.
    const booked = capture({ googleEventId: "google_abc" });

    assert.equal(confirmable(booked, CARLOS).verdict, "not-yours");
  });

  it("invents no hour for something nobody gave one", () => {
    const noTime = capture({ startsAt: null, endsAt: null });

    assert.equal(confirmable(noTime, ELVIA).verdict, "no-time");
  });

  it("invents no end either, when only the start was said", () => {
    assert.equal(confirmable(capture({ endsAt: null }), ELVIA).verdict, "no-time");
  });

  it("a second yes returns the first event instead of booking the afternoon twice", () => {
    const decision = confirmable(capture({ googleEventId: "google_abc" }), ELVIA);

    assert.equal(decision.verdict, "already-on-the-calendar");
    assert.equal(
      decision.verdict === "already-on-the-calendar" && decision.googleEventId,
      "google_abc",
    );
  });
});
