import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";

/**
 * The server's environment contract, validated on import: if something is
 * missing the process dies at start-up saying which. The alternative is finding
 * out when an `undefined` reaches the database connection, three screens later.
 */

const schema = z.object({
  DATABASE_URL: z
    .string()
    .startsWith("postgresql://", "DATABASE_URL must point at PostgreSQL"),

  /**
   * Reachable from a phone over mobile data, which rules out localhost: silent
   * auth returns through the carrier's network. It also has to match Google's
   * registered redirect URI character for character.
   */
  PUBLIC_URL: z.url().optional(),

  // Secrets are optional so that `next build` does not need them, and so a
  // missing one fails where it is used with a message naming it.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  VONAGE_VERIFY_APPLICATION_ID: z.string().min(1).optional(),
  VONAGE_VERIFY_PRIVATE_KEY_PATH: z.string().min(1).optional(),
  /** On Railway there is no key file, so it travels as content. */
  VONAGE_VERIFY_PRIVATE_KEY: z.string().min(1).optional(),

  VONAGE_API_BASE: z.url().default("https://api-eu.vonage.com"),
  VONAGE_BRAND_NAME: z.string().min(1).default("OFFLOAD"),

  /**
   * At least 32 characters. Spanish mobile numbers are about a billion
   * combinations: an unsalted SHA-256 of one is walked through in seconds, so
   * without this, storing the digest is storing the number.
   */
  VERIFICATION_PEPPER: z.string().min(32).optional(),

  TEST_PHONE_ELVIA: z.string().min(1).optional(),
  TEST_PHONE_CARLOS: z.string().min(1).optional(),
  TEST_EMAIL_ELVIA: z.string().min(1).optional(),
  TEST_EMAIL_CARLOS: z.string().min(1).optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  // A declared but empty variable is a missing one. A fresh copy of
  // `.env.example` carries `KEY=` on every line, and zod reads that as a
  // present empty string: `.optional()` does not cover it and `.default()`
  // does not fire. Cleaned here once rather than on every field.
  const provided = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value?.trim() !== ""),
  );

  const result = schema.safeParse(provided);

  if (!result.success) {
    // Variable NAMES only, never their values: an error message is no place
    // for a secret.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${problems}\n\nCheck your .env (the template is .env.example).`,
    );
  }

  return result.data;
}

export const env = load();

const MATERIALISED_KEY = join(tmpdir(), "vonage-verify.key");

/**
 * Writes the key that arrives as a variable to disk and returns its path,
 * because the Vonage SDK wants a path and not a string.
 *
 * The escaped `\n` are what breaks this: a key pasted without escaping reaches
 * the process on one line, and the SDK fails much later with a JWT format error
 * that never mentions newlines.
 */
function materialise(key: string): string {
  const pem = key.replace(/\\n/g, "\n");

  if (!pem.includes("\n")) {
    throw new Error(
      "VONAGE_VERIFY_PRIVATE_KEY is on a single line. The key is a multi-line PEM: " +
        "when pasting it into the panel, newlines go escaped as \\n.",
    );
  }

  // 0600, and written once per process: this runs on every verification.
  if (!existsSync(MATERIALISED_KEY)) {
    writeFileSync(MATERIALISED_KEY, pem, { mode: 0o600 });
  }

  return MATERIALISED_KEY;
}

export type VerifyCredentials = {
  applicationId: string;
  privateKeyPath: string;
  publicUrl: string;
  pepper: string;
};

/**
 * Checked at the door of a verification route, not at start-up, and listing
 * everything missing at once: finding them one at a time is four trips to the
 * Vonage panel instead of one.
 */
export function requireVerifyCredentials(): VerifyCredentials {
  const {
    VONAGE_VERIFY_APPLICATION_ID: applicationId,
    VONAGE_VERIFY_PRIVATE_KEY: keyAsValue,
    VONAGE_VERIFY_PRIVATE_KEY_PATH: keyOnDisk,
    PUBLIC_URL: publicUrl,
    VERIFICATION_PEPPER: pepper,
  } = env;

  // The value wins over the path: the template always leaves the path written,
  // and on Railway that file does not exist.
  const privateKeyPath = keyAsValue ? materialise(keyAsValue) : keyOnDisk;

  if (!applicationId || !privateKeyPath || !publicUrl || !pepper) {
    const missing = [
      !applicationId && "VONAGE_VERIFY_APPLICATION_ID",
      !privateKeyPath && "VONAGE_VERIFY_PRIVATE_KEY_PATH or VONAGE_VERIFY_PRIVATE_KEY",
      !publicUrl && "PUBLIC_URL",
      !pepper && "VERIFICATION_PEPPER",
    ].filter(Boolean);

    throw new Error(
      `Verification needs these variables and they are not in .env: ${missing.join(", ")}.`,
    );
  }

  // The template ships `./verify.key` already written, so the variable is set
  // from the first `cp` even when the file is not there. Without this the
  // failure arrives later, disguised as a network error.
  if (!existsSync(privateKeyPath)) {
    throw new Error(
      `VONAGE_VERIFY_PRIVATE_KEY_PATH points at ${privateKeyPath} and there is no file there. ` +
        "The private key is downloaded once, when the application is created in the Vonage panel.",
    );
  }

  return { applicationId, privateKeyPath, publicUrl, pepper };
}

export type GoogleCredentials = {
  clientId: string;
  clientSecret: string;
  publicUrl: string;
};

export function requireGoogleCredentials(): GoogleCredentials {
  const {
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    PUBLIC_URL: publicUrl,
  } = env;

  if (!clientId || !clientSecret || !publicUrl) {
    const missing = [
      !clientId && "GOOGLE_CLIENT_ID",
      !clientSecret && "GOOGLE_CLIENT_SECRET",
      !publicUrl && "PUBLIC_URL",
    ].filter(Boolean);

    throw new Error(
      `Connecting Google needs these variables and they are not in .env: ${missing.join(", ")}. ` +
        "Both Google ones come from a web application OAuth client in Google Cloud.",
    );
  }

  return { clientId, clientSecret, publicUrl };
}
