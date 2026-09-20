import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signGuestLinkToken, verifyGuestLinkToken } from "../../src/lib/guest-link.ts";

/**
 * The guest link, tested against its pure core and not `src/lib/env.ts`:
 * that module also validates `DATABASE_URL`, which is not set when
 * `npm run test:unit` runs. A throwaway secret and an explicit clock are all
 * this needs.
 */

const SECRET = "a-secret-at-least-32-characters-long";
const OTHER_SECRET = "a-different-secret-32-characters-x";
const NOW = Date.parse("2026-09-20T12:00:00+02:00");
const THIRTY_ONE_MINUTES = 31 * 60 * 1000;

describe("a guest link round-trips", () => {
  it("verifies back to the same person and session it was signed for", () => {
    const token = signGuestLinkToken("person_rosa", "session_1", SECRET, NOW);
    const check = verifyGuestLinkToken(token, SECRET, NOW);

    assert.deepEqual(check, { ok: true, personId: "person_rosa", sessionId: "session_1" });
  });

  it("still verifies a few minutes later, inside its window", () => {
    const token = signGuestLinkToken("person_rosa", "session_1", SECRET, NOW);
    const check = verifyGuestLinkToken(token, SECRET, NOW + 10 * 60 * 1000);

    assert.equal(check.ok, true);
  });
});

describe("a guest link rejects what it should", () => {
  it("expires past its thirty minutes", () => {
    const token = signGuestLinkToken("person_rosa", "session_1", SECRET, NOW);
    const check = verifyGuestLinkToken(token, SECRET, NOW + THIRTY_ONE_MINUTES);

    assert.deepEqual(check, { ok: false, reason: "expired" });
  });

  it("rejects a token signed with a different secret", () => {
    const token = signGuestLinkToken("person_rosa", "session_1", OTHER_SECRET, NOW);
    const check = verifyGuestLinkToken(token, SECRET, NOW);

    assert.deepEqual(check, { ok: false, reason: "malformed" });
  });

  it("rejects a tampered payload even with a valid-looking signature", () => {
    const token = signGuestLinkToken("person_rosa", "session_1", SECRET, NOW);
    const [, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ personId: "person_marta", sessionId: "session_1", exp: 9999999999 })).toString("base64url")}.${signature}`;

    assert.deepEqual(verifyGuestLinkToken(forged, SECRET, NOW), { ok: false, reason: "malformed" });
  });

  it("rejects nonsense", () => {
    assert.deepEqual(verifyGuestLinkToken("not-a-token-at-all", SECRET, NOW), {
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects an empty string", () => {
    assert.deepEqual(verifyGuestLinkToken("", SECRET, NOW), { ok: false, reason: "malformed" });
  });
});
