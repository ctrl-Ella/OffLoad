import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Who you are. A session is born from a completed verification or from a Google
 * sign-in, and from nothing else: if the line or the address belongs to nobody
 * known, both paths succeed and still open no session.
 */

const COOKIE = "offload_session";

/** Thirty days. Signing in every week is mental load, which is what this
 *  product exists to remove. */
const DURATION_DAYS = 30;

export type SignedInPerson = {
  id: string;
  name: string;
  circle: "CORE" | "SUPPORT";
  phoneTail: string;
};

/**
 * The token is opaque and server-generated: the person id never travels in the
 * cookie, not even signed. An identifier inside a cookie invites someone to
 * change it, and the whole application depends on knowing who you are.
 */
export async function openSession(personId: string): Promise<void> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({ data: { token, personId, expiresAt } });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    // `lax` and not `strict`: silent auth returns from the carrier's domain as
    // a full navigation, and `strict` would hold the cookie back on that trip.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function currentPerson(): Promise<SignedInPerson | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      person: { select: { id: true, name: true, circle: true, phoneTail: true } },
    },
  });

  if (!session) {
    log.info("session: cookie matches no session");
    return null;
  }

  // An expired session is absent and also deleted: leaving it in the table
  // makes the session list unreadable.
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { token } });
    return null;
  }

  return session.person;
}

export async function closeSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  // deleteMany and not delete: the row may already be gone if it expired and
  // was cleaned up on read.
  if (token) await db.session.deleteMany({ where: { token } });

  store.delete(COOKIE);
}
