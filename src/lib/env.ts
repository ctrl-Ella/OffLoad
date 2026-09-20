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

  /** Qualified like Verify's: with one of the two unqualified, that one reads
   *  as "the Vonage application". Neither is the default. */
  VONAGE_VIDEO_APPLICATION_ID: z.string().min(1).optional(),
  VONAGE_VIDEO_PRIVATE_KEY_PATH: z.string().min(1).optional(),
  /** On Railway the key travels as content, same as Verify's. */
  VONAGE_VIDEO_PRIVATE_KEY: z.string().min(1).optional(),
  /** Video has its own host. `api.opentok.com` is the previous generation and
   *  answers 403 to an application JWT. */
  VONAGE_VIDEO_BASE: z.url().default("https://video.api.vonage.com"),

  /** The virtual number Nicolás's SIP leg comes in on, and the SMS sender
   *  when Mia invites the support network. Declared here since spec 0009: it
   *  sat in `.env.example` since spec 0008 with nothing reading it. */
  VONAGE_NUMBER: z.string().min(1).optional(),

  /** The SMS API's own credentials: classic API key and secret over Basic
   *  auth, not the video application's JWT — the SMS API has no JWT form.
   *  From the account's API settings, never from an application. */
  VONAGE_SMS_API_KEY: z.string().min(1).optional(),
  VONAGE_SMS_API_SECRET: z.string().min(1).optional(),

  /**
   * At least 32 characters. Spanish mobile numbers are about a billion
   * combinations: an unsalted SHA-256 of one is walked through in seconds, so
   * without this, storing the digest is storing the number.
   */
  VERIFICATION_PEPPER: z.string().min(32).optional(),

  /** Signs a guest's one-time link into a call. Its own secret and not
   *  `VERIFICATION_PEPPER`: the two protect different things for different
   *  reasons, and reusing one for the other is the kind of coupling that
   *  reads as a mistake to whoever finds it next. */
  GUEST_LINK_SECRET: z.string().min(32).optional(),

  /** Nebius Token Factory: all the reasoning, at two tiers. The key is
   *  optional for the same reason as the rest; the model identifiers have no
   *  default in code because Nebius retires checkpoints without redirecting
   *  traffic, and a name written here expires without warning. */
  NEBIUS_API_KEY: z.string().min(1).optional(),
  NEBIUS_BASE_URL: z.url().default("https://api.tokenfactory.nebius.com/v1"),
  /** The interpreter's model: cheap extraction. */
  NEBIUS_MODEL_SMALL: z.string().min(1).optional(),
  /** The negotiator's model: the one that chooses whom to ask. */
  NEBIUS_MODEL_LARGE: z.string().min(1).optional(),

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
    VONAGE_VIDEO_APPLICATION_ID: applicationId,
    VONAGE_VIDEO_PRIVATE_KEY: keyAsValue,
    VONAGE_VIDEO_PRIVATE_KEY_PATH: keyOnDisk,
    VONAGE_VIDEO_BASE: videoBase,
  } = env;

  if (!applicationId || (!keyAsValue && !keyOnDisk)) {
    const missing = [
      !applicationId && "VONAGE_VIDEO_APPLICATION_ID",
      !keyAsValue && !keyOnDisk && "VONAGE_VIDEO_PRIVATE_KEY_PATH or VONAGE_VIDEO_PRIVATE_KEY",
    ].filter(Boolean);

    // Names the application: Verify's key signs a video token and fails
    // without saying which key was used.
    throw new Error(
      `The video call needs these variables and they are not set: ${missing.join(", ")}. ` +
        "They come from the VIDEO application in the Vonage panel, not from Verify's.",
    );
  }

  // The value wins over the path, same as verification: the template always
  // leaves the path written, and on Railway that file does not exist.
  if (keyAsValue) {
    return {
      applicationId,
      privateKey: pemFromVariable(keyAsValue, "VONAGE_VIDEO_PRIVATE_KEY"),
      videoBase,
    };
  }

  if (!existsSync(keyOnDisk as string)) {
    throw new Error(
      `VONAGE_VIDEO_PRIVATE_KEY_PATH points at ${keyOnDisk} and there is no file there. ` +
        "The video application's key downloads once, when the application is created. " +
        "Generating a new one in the panel invalidates the previous one.",
    );
  }

  return { applicationId, privateKey: readFileSync(keyOnDisk as string, "utf8"), videoBase };
}

export type SmsCredentials = { apiKey: string; apiSecret: string; from: string };

/**
 * What the SMS API needs, checked at the point an invite is actually sent —
 * not at start-up, the same way the other Vonage credentials are: a household
 * that never invites the support network should not fail to build over a
 * variable it never uses.
 */
export function requireSmsCredentials(): SmsCredentials {
  const { VONAGE_SMS_API_KEY: apiKey, VONAGE_SMS_API_SECRET: apiSecret, VONAGE_NUMBER: from } = env;

  if (!apiKey || !apiSecret || !from) {
    const missing = [
      !apiKey && "VONAGE_SMS_API_KEY",
      !apiSecret && "VONAGE_SMS_API_SECRET",
      !from && "VONAGE_NUMBER",
    ].filter(Boolean);

    throw new Error(
      `Inviting the support network needs these variables and they are not in .env: ${missing.join(", ")}. ` +
        "The key and secret come from the account's API settings in the Vonage dashboard, not from an application.",
    );
  }

  return { apiKey, apiSecret, from };
}

/** Checked at the point a guest link is signed or verified, not at start-up. */
export function requireGuestLinkSecret(): string {
  if (!env.GUEST_LINK_SECRET) {
    throw new Error(
      "GUEST_LINK_SECRET is missing from .env. A guest's link into the call cannot be signed without it.",
    );
  }

  return env.GUEST_LINK_SECRET;
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

/** The model key, demanded right before an agent is invoked, not at start-up. */
export function requireModelKey(): string {
  if (!env.NEBIUS_API_KEY) {
    throw new Error(
      "NEBIUS_API_KEY is missing from .env. The agents cannot answer without it: " +
        "it comes from tokenfactory.nebius.com, under API keys.",
    );
  }

  return env.NEBIUS_API_KEY;
}

/**
 * The model of one tier, by its variable name. If it is missing the error
 * says WHICH: "the agent does not answer" cannot be fixed, "NEBIUS_MODEL_LARGE
 * is missing" can. The live catalogue:
 *   curl -H "Authorization: Bearer $NEBIUS_API_KEY" $NEBIUS_BASE_URL/models
 */
export function requireModel(variable: "NEBIUS_MODEL_SMALL" | "NEBIUS_MODEL_LARGE"): string {
  const id = env[variable];

  if (!id) {
    throw new Error(
      `${variable} is missing from .env. It comes from Nebius's live catalogue, which changes: ` +
        `curl -H "Authorization: Bearer $NEBIUS_API_KEY" ${env.NEBIUS_BASE_URL}/models`,
    );
  }

  return id;
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
