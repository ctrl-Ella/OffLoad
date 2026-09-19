import { NextResponse } from "next/server";
import { z } from "zod";
import { browserAttempt, forgetAttempt } from "@/lib/attempt";
import { db } from "@/lib/db";
import { requireVerifyCredentials } from "@/lib/env";
import { log, reason } from "@/lib/log";
import { openSession } from "@/lib/session";
import { checkCode } from "@/lib/verification";

/**
 * Closes the circuit: trades the code for a status and writes it down.
 *
 * The phone number does NOT travel in this request. The row was created when
 * the attempt started and is found by `requestId`: personal data that does not
 * need moving, does not move.
 */

const request = z.object({
  requestId: z.uuid("Vonage's requestId is a UUID"),
  code: z.string().min(1).max(32),
  /** Which route closed it. The client knows: silent auth returns through the
   *  URL fragment, the fallback code is typed. */
  channel: z.enum(["silent_auth", "sms"]),
});

const COMPLETED = "completed";

export async function POST(incoming: Request) {
  try {
    requireVerifyCredentials();
  } catch (error) {
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

  const { requestId, code, channel } = parsed.data;

  // An identifier chosen by whoever is asking identifies nobody: with someone
  // else's code — an SMS they saw, or the fragment of a return URL — a session
  // would open as that person. Only the attempt this browser started counts.
  const open = await browserAttempt();

  if (!open || open !== requestId) {
    log.warn("verification: the attempt does not belong to this browser", { requestId });

    // 403 and not 404: the attempt exists, it is just not theirs. The text the
    // person sees does not distinguish the two, on purpose.
    return NextResponse.json({ error: "that attempt is not yours" }, { status: 403 });
  }

  let status: string;

  try {
    status = await checkCode(requestId, code);
  } catch (error) {
    log.warn("verification: code refused", { requestId, reason: reason(error) });
    return NextResponse.json({ error: "the code is not valid" }, { status: 400 });
  }

  // Only what actually completed gets marked. A row saying "verified" when it
  // is not is worse than no row — that is rule 4.
  if (status !== COMPLETED) {
    log.info("verification: not completed", { requestId, status });
    return NextResponse.json({ status });
  }

  try {
    const attempt = await db.verification.findUnique({
      where: { requestId },
      select: { phoneHash: true },
    });

    if (!attempt) {
      log.warn("verification: unknown attempt", { requestId });
      return NextResponse.json({ error: "that attempt does not exist" }, { status: 404 });
    }

    // Verifying proves the line is yours, not that you belong to this
    // household. An unknown number verifies just the same and simply opens no
    // session: nobody is signed up along the way.
    const person = await db.person.findUnique({
      where: { phoneHash: attempt.phoneHash },
      select: { id: true, name: true },
    });

    const row = await db.verification.update({
      where: { requestId },
      data: { status, channel, personId: person?.id ?? null },
      select: { phoneTail: true },
    });

    await forgetAttempt();

    if (person) await openSession(person.id);

    // The name is personal data; the id is enough to follow the trail.
    log.info("verification: completed", {
      requestId,
      channel,
      personId: person?.id ?? null,
    });

    return NextResponse.json({
      status,
      phoneTail: row.phoneTail,
      person: person ? { name: person.name } : null,
    });
  } catch (error) {
    log.error("verification: could not save", { requestId, reason: reason(error) });

    return NextResponse.json(
      { error: "the verification worked but could not be saved" },
      { status: 500 },
    );
  }
}
