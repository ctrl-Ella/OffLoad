import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireGoogleCredentials } from "@/lib/env";
import { exchangeCode } from "@/lib/google";
import { log, reason } from "@/lib/log";
import { openSession } from "@/lib/session";
import { STATE_COOKIE } from "@/app/api/auth/google/route";

/**
 * Google's return: stores the permission and opens a session. It redirects to
 * a screen rather than returning JSON, because whoever arrives is a browser
 * with a person behind it.
 *
 * The Google address is the SECOND way in, alongside the phone. Both answer the
 * same question — which person of the household is on the other side — and
 * neither signs anyone up.
 */

/**
 * Built from PUBLIC_URL and not from the request URL. Behind a tunnel the
 * request reaches the server with the internal hop's Host, so `request.url`
 * says localhost and would send the browser to a machine that is not theirs.
 */
function backTo(outcome: string): NextResponse {
  const { publicUrl } = requireGoogleCredentials();

  const destination = new URL("/", publicUrl);
  destination.searchParams.set("google", outcome);

  return NextResponse.redirect(destination);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;

  // Single use, whatever happens next.
  store.delete(STATE_COOKIE);

  // Someone saying no is an ordinary outcome, not a failure.
  const refusal = params.get("error");

  if (refusal) {
    log.info("google: permission not granted", { refusal });
    return backTo("no-permission");
  }

  const code = params.get("code");
  const state = params.get("state");

  // The comparison is the only thing tying this return to the earlier
  // outbound. No cookie means nothing to compare against, so it does not pass.
  if (!code || !state || !expected || state !== expected) {
    log.warn("google: return without a valid state", {
      hasCode: Boolean(code),
      hasCookie: Boolean(expected),
      matches: Boolean(state && expected && state === expected),
    });

    return backTo("invalid-return");
  }

  let permission;

  try {
    permission = await exchangeCode(code);
  } catch (error) {
    log.error("google: could not exchange the code", { reason: reason(error) });
    return backTo("failed");
  }

  const person = await db.person.findUnique({
    where: { email: permission.email },
    select: { id: true },
  });

  // Granting permission over your calendar does not put you in this household.
  // Storing the key to the calendar of someone who is not family would be the
  // worst thing this route could do.
  if (!person) {
    log.info("google: the account belongs to nobody in the household");
    return backTo("unknown");
  }

  // Google only sends a refresh token the first time permission is granted.
  // On a repeat it arrives empty, and overwriting the stored one with a null
  // would leave Mia unable to get back into that calendar.
  if (permission.refreshToken) {
    await db.googleAccount.upsert({
      where: { personId: person.id },
      create: {
        personId: person.id,
        email: permission.email,
        refreshToken: permission.refreshToken,
        scope: permission.scope,
      },
      update: {
        email: permission.email,
        refreshToken: permission.refreshToken,
        scope: permission.scope,
      },
    });
  } else {
    await db.googleAccount.updateMany({
      where: { personId: person.id },
      data: { email: permission.email, scope: permission.scope },
    });
  }

  await openSession(person.id);

  // The address stays out of the log: the id is enough to follow the trail.
  log.info("google: permission stored and session opened", {
    personId: person.id,
    newRefresh: Boolean(permission.refreshToken),
  });

  return backTo("connected");
}
