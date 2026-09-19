import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { env } from "../../src/lib/env.ts";
import { accessToken } from "../../src/lib/google.ts";
import { log, reason } from "../../src/lib/log.ts";
import { agenda, type DemoEvent } from "./events.ts";

/**
 * The demo week on the real Google calendars of the core circle.
 *
 *   npm run demo:seed    writes the week in events.ts
 *   npm run demo:clear   removes what this script wrote, and nothing else
 *   npm run demo:show    lists what this script wrote
 *
 * A command and not a route, and run by a person: rule 1 of the project is
 * that nothing reaches a calendar without a human yes, and here the yes is
 * typing the command.
 *
 * Every event carries a private marker, and both clear and show filter by it.
 * That is the whole safety of this script: what the family puts on their own
 * calendar has no marker, so it is never listed and never deleted.
 */

const MARKER = "offloadDemo";
const ZONE = "Europe/Madrid";
const CALENDAR = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Wide enough that an event left behind by an earlier, longer week is still
 *  found once its day is removed from events.ts. */
const MARGIN_DAYS = 30;

type GoogleEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
};

// Its own client rather than src/lib/db: that one is cached on globalThis for
// Next's reloads, and it imports through the `@/` alias, which
// `node --experimental-strip-types` does not resolve.
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  log: ["error"],
});

async function callGoogle(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${CALENDAR}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  // A delete answers 204 with an empty body, and `.json()` on that throws.
  if (response.status === 204) return null;

  const body = (await response.json()) as { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(
      `Google Calendar answered ${response.status}: ${body.error?.message ?? "no message"}`,
    );
  }

  return body;
}

/** The window the search covers, taken from the dates in events.ts so that
 *  adding a day to the file needs no second edit here. */
function searchWindow(): { min: string; max: string } {
  const days = Object.values(agenda)
    .flat()
    .map(({ date }) => Date.parse(`${date}T00:00:00Z`))
    .sort((a, b) => a - b);

  const margin = MARGIN_DAYS * 24 * 60 * 60 * 1000;

  return {
    min: new Date(days[0] - margin).toISOString(),
    max: new Date(days[days.length - 1] + margin).toISOString(),
  };
}

async function markedEvents(token: string): Promise<GoogleEvent[]> {
  const { min, max } = searchWindow();

  const query = new URLSearchParams({
    privateExtendedProperty: `${MARKER}=true`,
    timeMin: min,
    timeMax: max,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const body = (await callGoogle(token, `?${query}`)) as { items?: GoogleEvent[] };

  return body.items ?? [];
}

async function writeEvent(token: string, event: DemoEvent): Promise<void> {
  await callGoogle(token, "", {
    method: "POST",
    body: JSON.stringify({
      summary: event.title,
      location: event.place,
      start: { dateTime: `${event.date}T${event.from}:00`, timeZone: ZONE },
      end: { dateTime: `${event.date}T${event.to}:00`, timeZone: ZONE },
      extendedProperties: { private: { [MARKER]: "true" } },
      description:
        "Evento de demostración de OFFLOAD. Se borra con `npm run demo:clear`.",
    }),
  });
}

async function removeMarked(token: string): Promise<number> {
  const events = await markedEvents(token);

  for (const { id } of events) {
    await callGoogle(token, `/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  return events.length;
}

/** Google answers in UTC, and a week read against a Madrid calendar two hours
 *  out is a week nobody can check at a glance. */
function localTime(event: GoogleEvent): string {
  const starts = event.start?.dateTime ?? event.start?.date;

  if (!starts) return "sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(starts));
}

type Connected = { name: string; token: string };

/**
 * The core circle with Google connected. Someone without a stored token is
 * reported and skipped: their calendar cannot be reached until they sign in
 * with Google, and failing the whole run over it would leave the other
 * calendar half written.
 */
async function connectedPeople(): Promise<Connected[]> {
  const people = await db.person.findMany({
    where: { circle: "CORE" },
    select: { name: true, googleAccount: { select: { refreshToken: true } } },
    orderBy: { name: "asc" },
  });

  const connected: Connected[] = [];

  for (const { name, googleAccount } of people) {
    if (!googleAccount) {
      log.warn("demo-calendar: no Google connected, skipped", {
        person: name,
        fix: "sign in with Google as that person at /",
      });
      continue;
    }

    if (!agenda[name]) {
      log.warn("demo-calendar: nothing written for this person in events.ts", {
        person: name,
      });
      continue;
    }

    connected.push({ name, token: googleAccount.refreshToken });
  }

  return connected;
}

async function seed(person: Connected): Promise<void> {
  const token = await accessToken(person.token);

  // Rebuilt rather than added to, so running it twice does not double the week.
  const removed = await removeMarked(token);

  for (const event of agenda[person.name]) {
    await writeEvent(token, event);
  }

  log.info("demo-calendar: week written", {
    person: person.name,
    written: agenda[person.name].length,
    removedFirst: removed,
  });
}

async function clear(person: Connected): Promise<void> {
  const removed = await removeMarked(await accessToken(person.token));

  log.info("demo-calendar: demo events removed", { person: person.name, removed });
}

async function show(person: Connected): Promise<void> {
  const events = await markedEvents(await accessToken(person.token));

  log.info("demo-calendar: demo events on the calendar", {
    person: person.name,
    total: events.length,
  });

  // Titles are printed because these are the invented events this script wrote,
  // never anything the family put there: the marker filter guarantees it.
  for (const event of events) {
    process.stdout.write(`  ${localTime(event)}  ${event.summary ?? "(sin título)"}\n`);
  }
}

const commands = { seed, clear, show };

async function main(): Promise<void> {
  const command = process.argv[2] as keyof typeof commands | undefined;

  if (!command || !(command in commands)) {
    throw new Error(
      `demo-calendar needs one of: ${Object.keys(commands).join(", ")}. ` +
        "Run it as `npm run demo:seed`, `npm run demo:clear` or `npm run demo:show`.",
    );
  }

  const people = await connectedPeople();

  if (people.length === 0) {
    throw new Error(
      "Nobody in the core circle has Google connected, so there is no calendar to write to.",
    );
  }

  let failed = false;

  for (const person of people) {
    try {
      await commands[command](person);
    } catch (error) {
      // One person's failure does not stop the other's: a revoked token is
      // common and the rest of the run is still worth doing.
      failed = true;
      log.error("demo-calendar: failed for this person", {
        person: person.name,
        command,
        reason: reason(error),
      });
    }
  }

  if (failed) process.exitCode = 1;
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    await db.$disconnect();
    log.error("demo-calendar: did not run", { reason: reason(error) });
    process.exit(1);
  });
