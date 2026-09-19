import { cookies } from "next/headers";

/**
 * The verification in flight, tied to the browser that asked for it.
 *
 * Without this, `check` trusts the `requestId` in the request body: anyone who
 * gets hold of a requestId and its code could redeem them against our API and
 * open a session as that person. The identifier has to come from where the
 * attempt came from, not from whoever claims to have it.
 */

const COOKIE = "offload_attempt";

/** What Vonage allows for redeeming a code. */
const LIFETIME_SECONDS = 15 * 60;

/** `lax` and not `strict`: silent auth returns from the carrier's domain as a
 *  full navigation, and `strict` would hold the cookie back on that trip. */
export async function rememberAttempt(requestId: string): Promise<void> {
  const store = await cookies();

  store.set(COOKIE, requestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LIFETIME_SECONDS,
  });
}

export async function browserAttempt(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** Cleared as soon as it is redeemed: a closed attempt does not serve again. */
export async function forgetAttempt(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
