import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

  /** The video application, which is a different one from Verify's. */
  VONAGE_APPLICATION_ID: z.string().min(1).optional(),
  VONAGE_PRIVATE_KEY_PATH: z.string().min(1).optional(),
  /** On Railway the key travels as content, same as Verify's. */
  VONAGE_PRIVATE_KEY: z.string().min(1).optional(),
  /** Video has its own host. `api.opentok.com` is the previous generation and
   *  answers 403 to an application JWT. */
  VONAGE_VIDEO_BASE: z.url().default("https://video.api.vonage.com"),

  /**
   * At least 32 characters. Spanish mobile numbers are about a billion
   * combinations: an unsalted SHA-256 of one is walked through in seconds, so
   * without this, storing the digest is storing the number.
   */
  VERIFICATION_PEPPER: z.string().min(32).optional(),

  /** SLNG, which is what Mia says. Optional for the same reason as the rest:
   *  `next build` needs no secrets, and everything else works without a voice. */
  SLNG_API_KEY: z.string().min(1).optional(),
  /** Mia's voice is Catalina, on a model that only streams over WebSocket.
   *  Declared here so the casting is not lost; it speaks once the call exists. */
  SLNG_TTS_MODEL: z.string().min(1).default("cartesia/sonic:3.5"),
  SLNG_TTS_VOICE: z.string().min(1).default("162e0f37-8504-474c-bb33-c606c01890dc"),
  /** The stand-in for a whole clip over HTTP, which is what speaks today.
   *  Identifiers come from the environment because SLNG can retire one. */
  SLNG_TTS_CLIP_MODEL: z.string().min(1).default("deepgram/aura:2"),
  SLNG_TTS_CLIP_VOICE: z.string().min(1).default("aura-2-silvia-es"),
  /** Where a family's audio travels. The EU by default; `eu-central` does not exist. */
  SLNG_REGION: z.string().min(1).default("eu-west"),

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
 * The PEM inside a variable, whichever way it was pasted.
 *
 * Base64 is accepted because escaped newlines do not survive every route in:
 * Railway's CLI truncated the key at the first `\n`, storing 28 characters of
 * 1703 and reporting success. Base64 has no newlines to lose.
 */
function pemFromVariable(key: string, variable: string): string {
  const pem = key.includes("BEGIN")
    ? key.replace(/\\n/g, "\n")
    : Buffer.from(key, "base64").toString("utf8");

  if (!pem.includes("BEGIN") || !pem.includes("\n")) {
    throw new Error(
      `${variable} is not a usable PEM. Either the whole key with newlines ` +
        "escaped as \\n, or the same key base64-encoded.",
    );
  }

  return pem;
}

/**
 * Writes the key that arrives as a variable to disk and returns its path,
 * because the Vonage SDK wants a path and not a string.
 *
 * The escaped `\n` are what breaks this: a key pasted without escaping reaches
 * the process on one line, and the SDK fails much later with a JWT format error
 * that never mentions newlines.
 */
function materialise(key: string): string {
  const pem = pemFromVariable(key, "VONAGE_VERIFY_PRIVATE_KEY");

  // 0600, and written once per process: this runs on every verification.
  if (!existsSync(MATERIALISED_KEY)) {
    writeFileSync(MATERIALISED_KEY, pem, { mode: 0o600 });
  }

  return MATERIALISED_KEY;
}

export type VideoCredentials = {
  applicationId: string;
  /** The whole PEM, not its path: `tokenGenerate` signs with the content. */
  privateKey: string;
  videoBase: string;
};

/**
 * What the video room needs, which is less than verification: no public URL
 * and no pepper. Demanding those would leave the call off over a variable it
 * does not use.
 */
export function requireVideoCredentials(): VideoCredentials {
  const {
    VONAGE_APPLICATION_ID: applicationId,
    VONAGE_PRIVATE_KEY: keyAsValue,
    VONAGE_PRIVATE_KEY_PATH: keyOnDisk,
    VONAGE_VIDEO_BASE: videoBase,
  } = env;

  if (!applicationId || (!keyAsValue && !keyOnDisk)) {
    const missing = [
      !applicationId && "VONAGE_APPLICATION_ID",
      !keyAsValue && !keyOnDisk && "VONAGE_PRIVATE_KEY_PATH or VONAGE_PRIVATE_KEY",
    ].filter(Boolean);

    throw new Error(
      `The video call needs these variables and they are not in .env: ${missing.join(", ")}. ` +
        "They come from the video application in the Vonage panel.",
    );
  }

  // The value wins over the path, same as verification: the template always
  // leaves the path written, and on Railway that file does not exist.
  if (keyAsValue) {
    return { applicationId, privateKey: pemFromVariable(keyAsValue, "VONAGE_PRIVATE_KEY"), videoBase };
  }

  if (!existsSync(keyOnDisk as string)) {
    throw new Error(
      `VONAGE_PRIVATE_KEY_PATH points at ${keyOnDisk} and there is no file there. ` +
        "The private key is downloaded once, when the application is created in the Vonage panel.",
    );
  }

  return { applicationId, privateKey: readFileSync(keyOnDisk as string, "utf8"), videoBase };
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

export type MiaVoice = {
  apiKey: string;
  model: string;
  /** The voice inside the model. On the SLNG route the `model` field is this. */
  voice: string;
  /** The regional host, already built: the call never goes to `api.slng.ai` bare. */
  base: string;
};

/** The clip pair, which is what can speak today. Only the key can be missing. */
export function requireMiaVoice(): MiaVoice {
  const {
    SLNG_API_KEY: apiKey,
    SLNG_TTS_CLIP_MODEL: model,
    SLNG_TTS_CLIP_VOICE: voice,
    SLNG_REGION: region,
  } = env;

  if (!apiKey) {
    throw new Error(
      "Mia's voice needs SLNG_API_KEY and it is not in .env. It is generated per " +
        "project at app.slng.ai and shown once.",
    );
  }

  return { apiKey, model, voice, base: `https://${region}.api.slng.ai` };
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
