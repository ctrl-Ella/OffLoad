/**
 * Sending a text through Vonage's SMS API — the pure core, with no imports
 * at all.
 *
 * Deliberate: `npm run test:unit` runs this file directly with plain
 * `node --experimental-strip-types`, which does not understand this
 * project's `@/` alias the way Next and `bench:agents` do (see
 * `scripts/alias-hooks.mjs`). Credentials and `fetch` both travel in as
 * arguments so this file never needs to import `src/lib/env.ts`, which would
 * also drag in its `DATABASE_URL` validation — unset in the unit test run.
 * `src/lib/invite.ts` is the impure caller that reads the real credentials
 * and calls this.
 *
 * The one Vonage call in this project that does NOT go by JWT: checked
 * against the Vonage documentation MCP on 2026-09-20, the SMS API only
 * understands the account's API key and secret over Basic auth — there is no
 * JWT-authenticated form of it. CLAUDE.md's "everything goes through JWT"
 * rule exists because Basic auth cannot carry a webhook and this project
 * depends on them; this call needs no webhook, because Vonage's own
 * synchronous response already says whether it accepted the message. See
 * spec 0009's Decisions for the full reasoning.
 */

const SMS_HOST = "https://rest.nexmo.com/sms/json";

// No import for this either — see the file's own note on why it has none —
// so the timeout is `AbortController` used directly rather than this
// project's shared `fetchWithTimeout`. 15s matches that helper's own
// default: a single SMS accept/reject answer, not a slow upstream job.
const TIMEOUT_MS = 15_000;

export type SmsCredentials = { apiKey: string; apiSecret: string; from: string };

type SmsResponse = {
  messages?: Array<{
    status?: string;
    "message-id"?: string;
    "error-text"?: string;
  }>;
};

/** Vonage answered, and either refused the message or the platform did not
 *  behave like the documented contract. The message is safe to log: it never
 *  carries the phone number or the text, only Vonage's own status wording. */
export class SmsNotAccepted extends Error {}

export async function sendSmsWith(
  credentials: SmsCredentials,
  to: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = new URLSearchParams({
    from: credentials.from,
    to,
    text,
    // Spanish accents — í, ú, ñ — fall outside the GSM-7 table. Without this
    // they would arrive mangled instead of the message simply splitting into
    // more segments.
    type: "unicode",
    // No delivery receipt requested: nothing here has a webhook to receive
    // one, and "accepted by Vonage" is the bar this feature meets, not
    // "delivered to the phone".
    "status-report-req": "0",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetchImpl(SMS_HOST, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  // The SMS API answers HTTP 200 whether it worked or not: the real result
  // is the per-message `status` field inside the body, `"0"` for accepted.
  const parsed: SmsResponse | null = await response.json().catch(() => null);
  const first = parsed?.messages?.[0];

  if (!response.ok || !first || first.status !== "0") {
    throw new SmsNotAccepted(
      `Vonage did not accept the SMS: ${first?.["error-text"] ?? `HTTP ${response.status}`}`,
    );
  }

  return first["message-id"] ?? "";
}
