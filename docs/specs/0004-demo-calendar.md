# 0004 — The demo week on real Google calendars

| | |
|---|---|
| **Status** | Implemented |
| **Area** | qa · backend |
| **Issue** | #23 |
| **Date** | 2026-09-20 |

---

## Problem

Mia's whole job is finding a problem in a calendar before anyone sees it. Both calendars of the core circle are empty, so there is nothing to find. A rehearsal against an empty week cannot tell a correct answer from an answer that had nothing to say, and a jury watching one learns nothing about the product.

Filling them by hand is worse than it looks. It takes twenty minutes per person, it is gone the moment someone tidies their calendar, and nobody can say afterwards which events were the demo and which were real life.

---

## Acceptance criteria

- [x] One command writes the week, one removes it, one lists what is there
- [x] Running the seed twice leaves the same week, not two copies of it
- [x] Events the family added by hand are neither listed nor deleted by any of the three commands
- [x] Someone in the core circle without Google connected is reported by name and skipped, and the run continues for whoever is connected
- [x] The week lives in one file that can be edited without reading the script
- [x] The listing reads in Europe/Madrid, which is the calendars' timezone
- [x] No phone number, address or Google token reaches the output
- [x] `npm run typecheck` and `npm run lint` pass

---

## Scope

**The week**, 19 to 25 September 2026, in `scripts/demo-calendar/events.ts`: date, start, end, title and an optional place, keyed by the person's name in the `people` table. Titles are Spanish, because this is what the family reads in their own Google Calendar.

**Three commands**, in `scripts/demo-calendar/index.ts`:

| Command | What it does |
|---|---|
| `npm run demo:seed` | Rebuilds the week on every connected calendar |
| `npm run demo:clear` | Removes what the script wrote, and nothing else |
| `npm run demo:show` | Lists what the script wrote, in Europe/Madrid |

**The refresh of an access token**, `accessToken()` in `src/lib/google.ts`. Every call to Calendar and to Tasks needs one, so it belongs with the rest of the OAuth rather than in a script.

---

## Out of scope

**A `readCalendar` tool.** This writes; reading a calendar is a Mastra tool with a Zod schema and belongs to the orchestration lane. The refresh function is the piece the two share, which is why it is the only thing that landed in `src/lib`.

**A `src/lib/calendar.ts`.** Today the Calendar API has exactly one caller, and a module built for a second caller that does not exist yet is an abstraction with nothing to hold it in shape. The three HTTP calls stay inside the script until the tool needs them.

**Google Tasks.** The permission is already granted and the shopping list will need it. It is a different surface and a different spec.

**Recurring events.** A week of `RRULE` reads worse in the data file than a week of plain lines, and the demo is one week long.

**The clashes the demo turns on.** The week is deliberately sparse: Sunday is empty on both calendars and several afternoons are free. Whoever rehearses puts the collision where the story needs it, and a full week leaves nowhere to put it.

**Carlos's calendar, for now.** He exists in the core circle and has never connected Google, so there is no token and no calendar to write to. The command names him and carries on. His week is already written in `events.ts` and lands the first time the seed runs after he signs in.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| The events go on the real Google calendars | A local fixture the screen reads | The demo then exercises the same read path the product uses. A fixture would be thrown away the day `readCalendar` exists, and until then it would prove that a screen can render an array |
| A command a person types, never a route and never automatic | An endpoint, or a step in the seed | Rule 1 of the project is that nothing reaches a calendar without a human yes. Typing the command is that yes. An endpoint that writes to a family's calendar on a public URL is a different thing entirely |
| Every event carries a private `offloadDemo` marker, and `clear` and `show` filter by it | Deleting everything in the date range | This is somebody's real calendar. Without the marker, the command that tidies up after a rehearsal is also the command that deletes a dentist appointment nobody wrote down twice |
| `seed` deletes the marked events first and writes the week again | Adding to what is there, or refusing when it finds something | Editing a line in `events.ts` and re-running is the loop this file is for. Adding would double the week on the second run, and refusing would make the loop a three-step one |
| The search window comes from the dates in `events.ts`, plus 30 days either side | A window written in the file | Adding a day to the week then needs one edit, not two. The margin is what finds an event whose day was later removed from the file, which would otherwise stay on the calendar with nothing left to delete it |
| One person's failure is reported and the run continues | Stopping at the first error | A revoked token is an ordinary outcome while the Google app is unverified. Stopping would leave one calendar written and the other empty, which is the hardest state to reason about |
| No access token is cached | Caching it for its hour of life | Caching means deciding where it lives, which is a real question for a tool called on every run and no question at all for a command run by hand |
| Titles in Spanish inside a file named in English | Everything in one language | The repository rule and its exception, unchanged: paths and code in English, what the family reads in Spanish. These titles appear in Elvia's own calendar |
| `demo:seed` · `demo:clear` · `demo:show` | The `demo:sembrar` · `demo:borrar` · `demo:ver` already in `package.json` | English everywhere, including script names, is a root rule. The three they replaced pointed at `scripts/agenda-demo.ts`, which exists in no branch, so nothing was using them |

---

## Contract

**The data**, `scripts/demo-calendar/events.ts`:

```ts
type DemoEvent = {
  date: string;   // YYYY-MM-DD, Europe/Madrid
  from: string;   // HH:MM
  to: string;     // HH:MM
  title: string;
  place?: string;
};

const agenda: Record<string, DemoEvent[]>;  // keyed by `people.name`
```

**The refresh**, `src/lib/google.ts`:

```ts
function accessToken(refreshToken: string): Promise<string>;
```

**The marker** every event carries, and the only thing `clear` and `show` ever look at:

```json
{ "extendedProperties": { "private": { "offloadDemo": "true" } } }
```

---

## Verification

```bash
npm run typecheck && npm run lint
npm run demo:seed
npm run demo:show
```

1. `npm run demo:show` lists nine events for Elvia between Saturday the 19th and Friday the 25th, with Madrid times: the weekly shop at 11:00 on Saturday, work at 09:00 on weekdays, physiotherapy at 18:30 on Monday. Carlos is reported as not connected, by name.
2. Open Google Calendar as Elvia. The same nine are there, Sunday is empty, and every afternoon that `events.ts` leaves free is free.
3. Add an event by hand in Google, anywhere that week. Run `npm run demo:show`: it is not in the list.
4. Run `npm run demo:seed` again. The count stays at nine, and the event added by hand is still on the calendar.
5. Run `npm run demo:clear`. The nine are gone from Google and the one added by hand is still there.
6. Read the output of every run: no phone number, no address and no token appears in any line.

---

## Notes

**Carlos connects at `/`, with Google.** The account has to be one of the two in `people`, because the callback refuses an address it does not recognise. After that, `npm run demo:seed` writes both weeks.

**Adding to the week** means adding a line to `events.ts` and running `npm run demo:seed`. Any date works: the search window follows the dates in the file.

**Google's app is unverified**, so refresh tokens expire after seven days and every account has to be on the test user list. When `accessToken()` reports `invalid_grant`, that is what happened, and the way back is signing in with Google again.

**The stored refresh token opens a real calendar.** It is kept in the clear, which the schema already records as deliberate technical debt, and this spec is the point where that debt stops being theoretical: there is now a week of somebody's life behind it.

**Checked against the Google Calendar API v3 on 2026-09-20** by running the three commands: `privateExtendedProperty=offloadDemo=true` filters the listing, a delete answers `204` with an empty body, and `start.dateTime` without an offset is read in the `timeZone` sent beside it.
