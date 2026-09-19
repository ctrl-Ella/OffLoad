import { Auth } from "@vonage/auth";
import { Channels, SilentAuthChannel, Verify2 } from "@vonage/verify2";
import { env, requireVerifyCredentials } from "@/lib/env";

/**
 * Silent verification with Vonage Verify v2. All of it runs on the server: the
 * browser only ever receives the `checkUrl`, which is single-use and expires.
 */

// Built per call, not once at module level: importing this file should not
// read the private key off disk, and `next build` has no secrets.
function client(applicationId: string, privateKeyPath: string): Verify2 {
  return new Verify2(new Auth({ applicationId, privateKey: privateKeyPath }), {
    apiHost: env.VONAGE_API_BASE,
  });
}

export type StartedVerification = {
  requestId: string;
  /** `null` when silent auth did not get in. Not a failure: Vonage has
   *  started the verification and the fallback SMS is on its way. */
  checkUrl: string | null;
};

/**
 * Numbers starting with 990 belong to the Network Registry Playground. They are
 * served by a virtual operator that receives no SMS, and the API rejects the
 * whole request with a 422 if the workflow carries any other channel —
 * "silent_auth must be the only channel when virtual operator is used".
 */
const PLAYGROUND_PREFIX = "990";

/** Vonage answers 409 and will not start a second one for the same number. */
export class VerificationInFlight extends Error {
  constructor() {
    super("there is already a verification in flight for that number");
    this.name = "VerificationInFlight";
  }
}

// The shape and not the class name: the name is the SDK's business and changes
// without notice, the status code is part of the API's contract.
function isConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { response } = error as { response?: unknown };
  if (typeof response !== "object" || response === null) return false;
  return (response as { status?: unknown }).status === 409;
}

/**
 * What Vonage answered when it refused, fit for the log. `error.message` stops
 * at "status code 422" and the real reason is in the body. Long digit runs are
 * masked because those bodies quote the number.
 */
export async function errorDetail(error: unknown): Promise<string | null> {
  if (typeof error !== "object" || error === null) return null;
  const { response } = error as { response?: unknown };
  if (typeof response !== "object" || response === null) return null;
  if (typeof (response as { text?: unknown }).text !== "function") return null;

  try {
    const body = await (response as { text: () => Promise<string> }).text();
    return body.replace(/\d{6,}/g, "▮").slice(0, 300);
  } catch {
    return null;
  }
}

/**
 * `silent_auth` goes first because channels run in the order they are declared:
 * second would mean sending the SMS before trying anything.
 */
export async function startVerification(phone: string): Promise<StartedVerification> {
  const { applicationId, privateKeyPath, publicUrl } = requireVerifyCredentials();

  const silent = {
    channel: SilentAuthChannel.SILENT_AUTH,
    to: phone,
    redirectUrl: `${publicUrl}/verification/return`,
  } as const;

  let answer;

  try {
    answer = await client(applicationId, privateKeyPath).newRequest({
      brand: env.VONAGE_BRAND_NAME,
      workflow: phone.startsWith(PLAYGROUND_PREFIX)
        ? [silent]
        : [silent, { channel: Channels.SMS, to: phone }],
    });
  } catch (error) {
    if (isConflict(error)) throw new VerificationInFlight();
    throw error;
  }

  // `checkUrl` is missing when silent auth did not get in — the carrier does
  // not support it, the number is not in the Network Registry, or wi-fi was
  // still on. Treating that as an error threw away a good verification.
  return { requestId: answer.requestId, checkUrl: answer.checkUrl ?? null };
}

export async function checkCode(requestId: string, code: string): Promise<string> {
  const { applicationId, privateKeyPath } = requireVerifyCredentials();
  return client(applicationId, privateKeyPath).checkCode(requestId, code);
}
