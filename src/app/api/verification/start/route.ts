import { NextResponse } from "next/server";
import { z } from "zod";
import { rememberAttempt } from "@/lib/attempt";
import { db } from "@/lib/db";
import { requireVerifyCredentials } from "@/lib/env";
import { log, reason } from "@/lib/log";
import { phoneDigest, phoneTail } from "@/lib/phone";
import { VerificationInFlight, errorDetail, startVerification } from "@/lib/verification";

/**
 * Starts verifying a phone number and returns the `checkUrl` the browser has
 * to open as a full navigation, with wi-fi off: that is what makes the request
 * leave through the carrier's network, which is who confirms the line.
 */

/** E.164 without the `+`, which is how Verify wants it. Checked here and not
 *  in the client because what arrives from outside is untrusted. */
const request = z.object({
  phone: z
    .string()
    .regex(/^[1-9]\d{7,14}$/, "the phone goes in E.164 without the +, like 34600111222"),
});

const STARTED = "started";

export async function POST(incoming: Request) {
  let credentials;

  try {
    credentials = requireVerifyCredentials();
  } catch (error) {
    // 503 and not 500: this is missing configuration, not broken code. Logged
    // because otherwise a deployment without credentials is only visible from
    // the browser. The reason names variables, never their values.
    log.error("verification: configuration missing", { reason: reason(error) });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vonage not configured" },
      { status: 503 },
    );
  }

  let body: unknown;

  try {
    body = await incoming.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = request.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", detail: parsed.error.issues },
      { status: 400 },
    );
  }

  const { phone } = parsed.data;
  const digest = phoneDigest(phone, credentials.pepper);

  let started;

  try {
    started = await startVerification(phone);
  } catch (error) {
    // One was already in flight: recover it rather than fail. This happens
    // constantly in real use — the carrier gateway does not answer, whoever
    // tried goes back, and their fallback code is still valid.
    if (error instanceof VerificationInFlight) {
      const inFlight = await db.verification.findUnique({
        where: { phoneHash: digest },
        select: { requestId: true },
      });

      if (inFlight) {
        log.info("verification: picking up the one in flight", {
          requestId: inFlight.requestId,
        });

        await rememberAttempt(inFlight.requestId);
        return NextResponse.json({ requestId: inFlight.requestId, checkUrl: null });
      }
    }

    log.error("verification: could not start", {
      reason: reason(error),
      // Without this a 422 leaves only "status code 422" in the log, and the
      // why — channel, format, workflow — is in the response body.
      detail: await errorDetail(error),
    });

    // The detail stays on the server: Vonage's errors quote the number.
    return NextResponse.json({ error: "could not start verification" }, { status: 502 });
  }

  // Written here, the only place the number exists, so it does not have to
  // travel back from the browser when the circuit closes.
  try {
    await db.verification.upsert({
      where: { phoneHash: digest },
      create: {
        phoneHash: digest,
        phoneTail: phoneTail(phone),
        requestId: started.requestId,
        status: STARTED,
      },
      // A new attempt replaces the old one, so a "verified" from half an hour
      // ago does not stay on screen.
      update: { requestId: started.requestId, status: STARTED, channel: null },
    });
  } catch (error) {
    log.error("verification: could not record the attempt", {
      requestId: started.requestId,
      reason: reason(error),
    });

    return NextResponse.json({ error: "could not record the attempt" }, { status: 500 });
  }

  // `silent` is here because without it the log cannot tell the two paths
  // apart: a silent auth that never gets in and a fallback that always works
  // look identical from outside. The number is not logged; the id is.
  log.info("verification: started", {
    requestId: started.requestId,
    silent: started.checkUrl !== null,
  });

  await rememberAttempt(started.requestId);

  return NextResponse.json(started);
}
