import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { createSession } from "@/lib/video";

/**
 * The household's room: the same one for the whole core circle, created once.
 *
 * Stored rather than created on every join because a Vonage session is an
 * identifier, not a meeting: two calls to `createSession()` are two different
 * rooms, and whoever entered through each would see only themselves with
 * nothing failing. Stored in Postgres and not in memory because on Railway the
 * process restarts when it pleases, and the room would go with it mid-call.
 */

/** There is one household today. Named here so the value is never written loose. */
const HOUSEHOLD_KEY = "core";

/** Postgres's code for a unique key that already existed. */
const ALREADY_EXISTED = "P2002";

/**
 * The room that already exists, creating none. For whoever only wants to
 * look: opening a room to check whether it is empty would answer its own
 * question.
 */
export async function openRoom(): Promise<string | null> {
  const stored = await db.room.findUnique({ where: { key: HOUSEHOLD_KEY } });

  return stored?.sessionId ?? null;
}

export async function householdRoom(): Promise<string> {
  const stored = await db.room.findUnique({ where: { key: HOUSEHOLD_KEY } });

  if (stored) return stored.sessionId;

  const sessionId = await createSession();

  try {
    await db.room.create({ data: { key: HOUSEHOLD_KEY, sessionId } });

    log.info("room: stored");

    return sessionId;
  } catch (error) {
    // Elvia and Carlos pressing at the same time is the normal case: both find
    // the table empty and both create. Whoever arrives second keeps the
    // first's room, which is exactly what puts them in the same one.
    if (error instanceof Error && "code" in error && error.code === ALREADY_EXISTED) {
      const winner = await db.room.findUnique({ where: { key: HOUSEHOLD_KEY } });

      if (winner) {
        log.info("room: two at once, the first one stands");

        return winner.sessionId;
      }
    }

    throw error;
  }
}
