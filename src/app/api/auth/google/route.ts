import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { consentUrl } from "@/lib/google";
import { log, reason } from "@/lib/log";

/**
 * Sends the browser to Google's consent screen. A redirect and not a fetch:
 * the person has to see that screen, and only Google can show it.
 */

/**
 * The `state` is the only thing stopping someone forging a return with their
 * own code and passing it off as this browser's. It goes in an httpOnly cookie
 * — the page's JavaScript cannot read it — and is compared on the way back.
 */
export const STATE_COOKIE = "offload_google_state";

/** How long someone takes to decide on Google's screen, with room. */
const STATE_LIFETIME_S = 10 * 60;

export async function GET() {
  let destination: string;

  try {
    const state = randomUUID();

    // The URL first: if configuration is missing it fails here and leaves no
    // cookie hanging off a return that will never happen.
    destination = consentUrl(state);

    const store = await cookies();
    store.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: STATE_LIFETIME_S,
    });
  } catch (error) {
    log.error("google: could not ask for permission", { reason: reason(error) });

    // 503 and not 500: missing configuration, not broken code.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google not configured" },
      { status: 503 },
    );
  }

  log.info("google: asking for permission");

  return NextResponse.redirect(destination);
}
