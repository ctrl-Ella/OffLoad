import { tokenGenerate } from "@vonage/jwt";
import { requireVideoCredentials } from "@/lib/env";
import { log, reason } from "@/lib/log";

/**
 * The video room on Vonage: creating it, handing out keys, switching on the
 * captions that are Mia's ears, and looking who is inside.
 *
 * Silent verification lives apart in `verification.ts`: it shares the
 * private key with this and nothing else — different API, different host,
 * different way to authenticate.
 *
 * No `@vonage/server-sdk`. This is four REST calls and a JWT; the whole SDK
 * would bring the rest of the platform along to not use it. Checked against
 * the Vonage documentation MCP on 2026-09-20: the host is
 * `video.api.vonage.com`, the old `api.opentok.com` answers 403 to an
 * application JWT.
 */

/**
 * Elvia and Carlos both enter as `publisher`: there is no hierarchy inside
 * the room, and making whoever opened the call a moderator would invent one.
 * The `moderator` is signed by the server for itself, because live captions
 * demand it and a publisher token cannot start them.
 */
export type RoomRole = "publisher" | "moderator";

/** One hour. Longer than the call, shorter than a forgotten tab. */
const TOKEN_TTL = 60 * 60;

/** Half an hour. Longer than one of these conversations; the minimum is five minutes. */
const CAPTIONS_SECONDS = 1800;

function applicationJwt(applicationId: string, privateKey: string): string {
  return tokenGenerate(applicationId, privateKey, {});
}

/**
 * Opens a room and returns its identifier.
 *
 * Created `routed`, and it is decided here or not at all: `p2p.preference`
 * set to `disabled` is what puts the Media Router in the middle, and without
 * it there are no live captions and no SIP leg — both read the audio there.
 * It cannot be changed later on a session that exists.
 */
export async function createSession(): Promise<string> {
  const { privateKey, applicationId, videoBase } = requireVideoCredentials();

  const response = await fetch(`${videoBase}/session/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${applicationJwt(applicationId, privateKey)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "archiveMode=manual&p2p.preference=disabled",
  });

  if (!response.ok) {
    throw new Error(`Vonage did not create the room: ${response.status}`);
  }

  // An array with one session, not the object.
  const body: unknown = await response.json();
  const first = Array.isArray(body) ? body[0] : body;
  const sessionId =
    typeof first === "object" && first !== null && "session_id" in first
      ? first.session_id
      : undefined;

  if (typeof sessionId !== "string" || sessionId === "") {
    throw new Error("Vonage answered without a session_id");
  }

  log.info("room: created");

  return sessionId;
}

/**
 * The key a browser enters the room with. The claims are the ones the Video
 * API asks for, and two of them are traps: `sub` goes as a claim of its own,
 * never through the `subject` option, which the generator would copy into the
 * payload beside it; and `data` carries nothing, because whoever is in the
 * session can read it, and once someone enters through the SIP leg,
 * "whoever" grows.
 */
export function sessionToken(sessionId: string, role: RoomRole = "publisher"): string {
  const { privateKey, applicationId } = requireVideoCredentials();

  // A fresh literal on every call: the generator deletes keys from the object
  // it receives.
  return tokenGenerate(applicationId, privateKey, {
    sub: "video",
    scope: "session.connect",
    session_id: sessionId,
    role,
    acl: { paths: { "/session/**": {} } },
    ttl: TOKEN_TTL,
  });
}

/**
 * Switches on the room's live captions. Without them Mia hears nothing of
 * what is said. A MODERATOR token is required, so one is signed here for the
 * server; only `routed` sessions support them; and there is one captioning
 * run per session, so a 409 when the second person enters means they were
 * already on, not that something failed. They stop by themselves sixty
 * seconds after the last client disconnects.
 */
export async function startCaptions(sessionId: string): Promise<void> {
  try {
    const { privateKey, applicationId, videoBase } = requireVideoCredentials();

    const response = await fetch(`${videoBase}/v2/project/${applicationId}/captions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${applicationJwt(applicationId, privateKey)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        token: sessionToken(sessionId, "moderator"),
        languageCode: "es-ES",
        maxDuration: CAPTIONS_SECONDS,
        // Partials arrive word by word while someone speaks, so the screen moves.
        partialCaptions: true,
      }),
    });

    if (response.ok) {
      log.info("room: captions on");
      return;
    }

    log.info(response.status === 409 ? "room: captions were already on" : "room: captions did not start", {
      status: response.status,
    });
  } catch (error) {
    // The call works without captions: what is lost is Mia hearing.
    log.warn("room: captions did not start", { reason: reason(error) });
  }
}

/**
 * Whether anyone is publishing in the room right now.
 *
 * Vonage is asked, not a flag of ours: marking "call open" when someone joins
 * means remembering to unmark it, and whoever closes the tab without hanging
 * up does not. The active streams are the truth, not a record of it. With
 * nobody inside it answers `200` with `count: 0`; the documentation says
 * `404`, and both mean the same thing.
 */
export async function anyoneInRoom(sessionId: string): Promise<boolean> {
  try {
    const { privateKey, applicationId, videoBase } = requireVideoCredentials();

    const response = await fetch(
      `${videoBase}/v2/project/${applicationId}/session/${sessionId}/stream`,
      {
        headers: {
          Authorization: `Bearer ${applicationJwt(applicationId, privateKey)}`,
          Accept: "application/json",
        },
      },
    );

    if (response.status === 404) return false;

    if (!response.ok) {
      log.warn("room: could not look who is inside", { status: response.status });
      return false;
    }

    const body: unknown = await response.json();

    return (
      typeof body === "object" &&
      body !== null &&
      "count" in body &&
      typeof body.count === "number" &&
      body.count > 0
    );
  } catch (error) {
    // Polled every few seconds from the home screen. A stumble cannot take
    // the page down: the worst that happens is the notice arrives a turn late.
    log.warn("room: could not look who is inside", { reason: reason(error) });

    return false;
  }
}
