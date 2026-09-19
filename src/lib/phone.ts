import { createHash } from "node:crypto";

/**
 * What gets stored of a phone number, which is never the number.
 *
 * Separate from the Vonage client because these are pure functions and because
 * the seed script needs them: hanging them off the client would mean needing
 * Vonage credentials to compute two hashes.
 */

/**
 * A phone number is personal data and there is no need to hold it in the clear:
 * the only question ever asked is whether this number was already verified.
 */
export function phoneDigest(phone: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${phone}`).digest("hex");
}

/** Three digits tell Elvia from Carlos on screen and rebuild no number. */
export function phoneTail(phone: string): string {
  return phone.slice(-3);
}
