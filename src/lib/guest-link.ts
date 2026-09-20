import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A one-time link into the household's room for someone in the support
 * network, who has no account and no sign-in to go through.
 *
 * Self-contained and signed, not a database row: no Postgres is reachable in
 * this environment to add and run a migration against, and a signature plus
 * an expiry make a token un-forgeable and time-limited without persisting
 * anything. See spec 0009's Decisions for the trade-off this accepts.
 *
 * No `@/` imports: `npm run test:unit` runs this file directly with plain
 * `node --experimental-strip-types`, which does not resolve that alias
 * (see `scripts/alias-hooks.mjs`). The secret and the clock both travel in
 * as arguments; `src/lib/invite.ts` and the guest route are the impure
 * callers that read the real secret from `src/lib/env.ts`.
 */

/** Half an hour: generous enough to rejoin after a dropped connection on
 *  mobile data, short enough that a screenshotted link does not open a much
 *  later, unrelated call. Deliberately reusable inside this window, not
 *  single-use — see spec 0009. */
const TTL_SECONDS = 30 * 60;

export type GuestLinkCheck =
  | { ok: true; personId: string; sessionId: string }
  | { ok: false; reason: "malformed" | "expired" };

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signGuestLinkToken(
  personId: string,
  sessionId: string,
  secret: string,
  now: number = Date.now(),
): string {
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ personId, sessionId, exp })).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyGuestLinkToken(token: string, secret: string, now: number = Date.now()): GuestLinkCheck {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) return { ok: false, reason: "malformed" };

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);

  // Different lengths would throw inside `timingSafeEqual` rather than
  // answering false, so the length check comes first.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "malformed" };
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof (decoded as { personId?: unknown }).personId !== "string" ||
    typeof (decoded as { sessionId?: unknown }).sessionId !== "string" ||
    typeof (decoded as { exp?: unknown }).exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  const { personId, sessionId, exp } = decoded as { personId: string; sessionId: string; exp: number };

  if (exp < Math.floor(now / 1000)) return { ok: false, reason: "expired" };

  return { ok: true, personId, sessionId };
}
