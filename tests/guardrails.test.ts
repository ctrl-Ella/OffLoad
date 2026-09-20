import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  correctInventedAvailability,
  proposalSchema,
  type Proposal,
} from "../src/mastra/agents/support-network.ts";

/**
 * The product rules that do not bend, checked against the code that can
 * break them today. Only rule 3 is here, and that is deliberate: the other
 * five are still checked by hand because no code capable of breaking them
 * exists yet. A test written against something not yet built checks nothing.
 * They enter here as their code appears.
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
