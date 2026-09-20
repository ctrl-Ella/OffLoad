import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendSmsWith, SmsNotAccepted } from "../../src/lib/sms.ts";

/**
 * `sendSmsWith` against a faked `fetch`, never a real one: there are no
 * Vonage SMS credentials in this environment, and this is exactly why the
 * function takes its credentials and its `fetch` as arguments instead of
 * reading `src/lib/env.ts` — that module also validates `DATABASE_URL`,
 * unset when `npm run test:unit` runs.
 */

const CREDENTIALS = { apiKey: "key", apiSecret: "secret", from: "34600000000" };

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return (async () =>
    ({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    }) as Response) as typeof fetch;
}

describe("sendSmsWith", () => {
  it("resolves with the message id when Vonage accepts it", async () => {
    const id = await sendSmsWith(
      CREDENTIALS,
      "34611111111",
      "hola",
      fakeFetch({ messages: [{ status: "0", "message-id": "abc123" }] }),
    );

    assert.equal(id, "abc123");
  });

  it("signs the request with Basic auth built from the credentials", async () => {
    let seenAuth: string | null = null;

    const capturing: typeof fetch = (async (_url, init) => {
      seenAuth = (init?.headers as Record<string, string>).Authorization;
      return { ok: true, status: 200, json: async () => ({ messages: [{ status: "0" }] }) } as Response;
    }) as typeof fetch;

    await sendSmsWith(CREDENTIALS, "34611111111", "hola", capturing);

    assert.equal(seenAuth, `Basic ${Buffer.from("key:secret").toString("base64")}`);
  });

  it("rejects when Vonage's own status says it was not accepted", async () => {
    await assert.rejects(
      sendSmsWith(
        CREDENTIALS,
        "34611111111",
        "hola",
        fakeFetch({ messages: [{ status: "9", "error-text": "Partner quota violation" }] }),
      ),
      SmsNotAccepted,
    );
  });

  it("rejects when the response carries no message at all", async () => {
    await assert.rejects(sendSmsWith(CREDENTIALS, "34611111111", "hola", fakeFetch({})), SmsNotAccepted);
  });

  it("rejects on a transport-level failure too, not only a bad status field", async () => {
    await assert.rejects(
      sendSmsWith(CREDENTIALS, "34611111111", "hola", fakeFetch({ messages: [] }, false)),
      SmsNotAccepted,
    );
  });
});
