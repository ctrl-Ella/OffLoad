# 0007 — Confirming what Mia heard, and breaking down what does not fit

| | |
|---|---|
| **Status** | Draft |
| **Area** | frontend · backend |
| **Issue** | #NN |
| **Date** | 2026-09-20 |

---

## Problem

Someone in the core circle dictates their week, Mia lays it out correctly on the review screen,
and then it is gone. The screen shows what she understood and offers no way to act on it: leaving
the screen loses every line of it, because nothing from that flow is written anywhere.

That is not a gap left by accident. Spec 0002 stopped one screen short on purpose, because the
step it was missing is the one rule 1 governs — nothing reaches a calendar without a human yes —
and there was no screen where that yes could be given. This is that screen.

Three things stand between the two halves today:

- `/api/structure-plan` throws away the machine-readable times. The model returns
  `start` and `end` as ISO, the route formats them into `"jue 18:30 – 19:30"` for display and
  keeps only the string. Nothing downstream can write an event it only knows as prose.
- Nothing from the voice flow reaches the `captures` table, even though that table exists for
  exactly this and `googleEventId` was designed to be the place a confirmation lands.
- `src/lib/calendar.ts` only reads. The only code in the repository that creates a Google event
  lives in `scripts/demo-calendar/`, which seeds a fixed demo week and is not reusable from a
  request.

Two more surfaced while building it, both visible on the screen itself.

**The clash cards multiply and lead nowhere.** `/api/structure-plan` had its own clash detector
comparing every pair, so four things at the same hour produced six cards all saying the same
thing. `conflicts.ts` had already settled that question — consecutive stops only, so A-B and B-C
read as two problems in a row rather than three pairs — and having a second answer to it in a
second file is one piece of knowledge written down twice, with the worse version the one people
see. And once seen, a clash card offered nothing: the screen that breaks a clash down exists, at
`/conflict`, and nothing linked to it.

**Times were parsed without a zone.** The extraction returns `2026-09-24T18:30:00` with no
offset, and `new Date()` reads that as the host's local time. The container runs in UTC, so half
past six in Madrid was being handled as half past six in London. Harmless while it was only ever
formatted back out on the same host; an hour's error the moment anything is written to a real
calendar.

The cost of the third gap is bigger than one screen. `coreRange` in `src/lib/schedule.ts` already
reads unwritten captures and counts them in the clash arithmetic, and the home calendar already
paints them as `pending`. Both work today and neither has anything to show, because the only
producer of captures is the Mastra workflow. The voice flow feeds nothing.

---

## Acceptance criteria

- [ ] After dictating something with a time, the review screen shows an **Add to calendar** button
      on that row and on no other
- [ ] Pressing it creates the event in that person's Google Calendar, at the stated time, in the
      household's timezone
- [ ] The row only says it is on the calendar after Google has confirmed the write — never before,
      and never if the write failed
- [ ] Pressing it twice, or reloading and pressing again, results in one event and not two
- [ ] An item Mia understood but could not put a time to shows why it has no button, in words
- [ ] Signing in as the other core person and reloading `/offload` does not expose or allow
      confirming the first person's captures
- [ ] What was dictated survives a reload: the captures are in the database whether or not anyone
      confirmed them
- [ ] A confirmed event appears on the home calendar as that person's, no longer marked pending
- [ ] Every button reaches its own name through a screen reader — three rows do not produce three
      buttons called "Add to calendar" and nothing else
- [ ] The result of pressing it is announced, not only drawn
- [ ] Whoever has not connected Google is told that, rather than being shown a button that fails
- [ ] Four things dictated at the same hour produce the clashes `conflicts.ts` finds, not one card
      per pair
- [ ] A clash card links to that clash's day on `/conflict`, and landing there shows the day asked
      for rather than today
- [ ] An event dictated for half past six in Madrid is written to Google at half past six in
      Madrid, in winter and in summer

---

## Scope

**Persisting what the voice flow extracts.** `/api/structure-plan` writes one `Capture` per
extracted item, under the signed-in person, with `googleEventId` empty. Events become `kind:
"stop"`, tasks become `kind: "reminder"` — the two labels from the interpreter's table that mean
exactly those things.

**Not writing the same thing twice.** The route reuses the workflow's rule: same person, same
title, same start is the same capture. Dictating a sentence again does not double it.

**A write path to Google Calendar from a request.** `createEvent` joins `eventsBetween` in
`src/lib/calendar.ts`, same module, same border with `google.ts`: there the permission, here what
is done with it.

**One endpoint that turns a yes into an event.** `POST /api/captures/[id]/confirm` checks the
capture belongs to whoever is asking, writes it, stores the returned Google id, and answers with
it. It is the only place in the application that creates a calendar event.

**The button, and the three states it can be in.** Ready, writing, on the calendar. Plus the two
ways it can fail, each said differently: Google not connected is something to go and do, Google
not answering is something to try again.

**One clash detector for the whole product.** `/api/structure-plan` loses its own and calls
`conflictsForOnePerson`, which is the one with tests behind it. The cards keep their Spanish
wording and now derive it from the clash's `reason`, so an overlap and a trip there is no time
for do not read the same.

**A clash card that leads to the breakdown.** It links to `/conflict?day=YYYY-MM-DD`, and that
screen learns to read the day instead of always looking at today. The link is honest because of
the persistence above: the dictated stop is a capture now, `coreRange` already reads unwritten
captures, so the clash really is there when the screen goes looking for it.

**The household's zone, applied where the time is parsed.** The offset comes from the day itself
through `clock.ts`, which is what keeps the last Sunday of October from moving everybody's
evening.

---

## Out of scope

**Tasks.** A task has no clock time, so it belongs in Google Tasks and not in a calendar. The
permission is already granted and the API is a different one, with its own list ids and its own
failure modes. Putting a task on a calendar at an invented hour would be the product claiming
something nobody said. Task rows keep their card and get no button.

**Editing before confirming.** If Mia heard the wrong hour, the only thing to do here is not
confirm it and say it again. This is the first thing anyone will want next, and it is a screen of
its own, not a field bolted onto a card.

**Undoing a confirmation.** Deleting the event from Google Calendar is where the yes was already
given, and a second undo path here would be a second source of truth about the same event.

**Checking the new event against the calendar for clashes.** The arithmetic exists in
`conflicts.ts` and the home calendar already applies it to captures. Running it inside the
confirmation would put a second, quieter clash detector in the product, with no screen to show
what it found.

**Confirming several at once.** One card, one yes, which is the shape the rest of the product
already uses. A "confirm all" button asks for one yes to several changes of plan.

**Any change to the Mastra workflow.** `resolveConflict` writes captures already. It gains
nothing here, and touching its state machine to add a button is more risk than the button is
worth. The consequence is written down under Notes: its `interpret` step still carries its own
copy of the deduplication rule.

**Choosing which clash the breakdown shows.** `/conflict` shows the first clash of the day it is
given. With two separate clashes on one day, both cards link to the same breakdown. Fixing it
means the screen taking a clash and not only a day, which is a piece of its own.

---

## Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Persist a capture at extraction, confirm by its id | Send title and times from the browser to a write endpoint | The browser would become the source of an event's time, and nothing dictated would survive leaving the screen. Persisting also connects this flow to `coreRange`, which already reads captures and has had nothing to read |
| A Next route, not a Mastra tool | `writeEvent` as the seventh step of `resolveConflict` | The voice flow does not run through Mastra at all, so a tool would mean starting a run to serve one button. The write itself lives in `calendar.ts`, which is the function a `writeEvent` tool would call the day it exists |
| `captureId` is null when a row cannot be written | A separate `confirmable` boolean | One field with one meaning: the id of what can be confirmed. A row with no time, a task and a clash are all "nothing to write here", and the screen says which one it is from `type` and `detail` |
| Idempotent by `googleEventId` | A lock, or trusting the button's disabled state | A disabled button is a statement about one browser. The row already records whether this was written, so a second confirmation returns the first event instead of creating another |
| No session means no buttons, not an error | `401` from `/api/structure-plan` | Someone not signed in can still dictate and see what Mia understood. What they cannot do is write to a calendar, because there is no calendar to write to |
| The teal primary button, at small size | A new variant for a card action | It is a fill, so its contrast is the measured 11.86:1 pair regardless of the card behind it, and this is the screen's main action |
| `conflictsForOnePerson` for the dictated items too | Keeping the pairwise detector in the route | Two answers to "what counts as a clash" is duplicated knowledge, and the duplicate had no tests and produced six cards where the tested one produces the problems in a row |
| A failed write turns the card onto the alert surface | Coral error text on the normal card | That pair is measured against this background — 13.86:1 — and red text on the dark card is a contrast nobody has measured |
| `?day=` falls back to today when malformed | Refusing with a 404 | It arrives from a link somebody followed. A broken link is not an attack, and whether there is a clash on the day it lands on is already answered |

---

## Verification

```bash
npm run dev
```

1. Sign in as Elvia, with Google connected.
2. Open `/offload` and dictate: «El jueves a las seis y media llevo al niño a natación, y hay que
   comprar el regalo de Marta antes del viernes.»
3. Check the review screen: the swimming row has an **Add to calendar** button, the present row
   does not, and says it is a task.
4. Press the button. It shows it is working, then says the event is on the calendar. Nothing says
   so before that.
5. Open Google Calendar for that account: the event is on the right Thursday at 18:30, one of it.
6. Press the button again if it is still there, or reload `/offload` and repeat steps 2 to 4 with
   the same sentence. Google Calendar still has one event, not two.
7. Disconnect the network and repeat with another sentence: the row says Mia could not reach the
   calendar and to try again. The event is not claimed as written.
8. Open the home screen: the confirmed stop is there as Elvia's, without the pending mark.
9. Sign in as Carlos in another browser and open `/offload`: none of Elvia's captures are visible.
10. With a keyboard alone, reach every button on the review screen, press one, and check the focus
    outline is visible throughout and that the result is announced.
11. Dictate four things at the same hour on the same day. Count the clash cards: they are the
    problems in a row that `conflicts.ts` finds, not one per pair.
12. Press **Break this clash down** on one of them. The breakdown opens on that clash's day, and
    the line counting the others names that day rather than saying "today".

```bash
npm run test:guardrails   # rule 1, and rule 3
npm run test:unit
```

---

## Notes

**What this does not verify.** Steps 9 and 10 need a real second account and a real screen reader.
The button's accessible name and the live region are written to the specification; whether VoiceOver
and TalkBack announce the state change once, twice or not at all has to be heard, not read.

**Timezone.** The event is written with `timeZone: "Europe/Madrid"` from `ZONE`, the same constant
`clock.ts` uses everywhere else. The container runs in UTC and does not get a vote.

**Google's own limits.** An account in testing has its grant expired by Google after a week. That
surfaces here as `invalid_grant`, which `schedule.ts` already knows how to tell apart from a
calendar that did not answer, and the same distinction is made in the confirmation route.

**Rule 1 has a guardrail now.** `tests/guardrails.test.ts` said the other five rules were checked
by hand "because no code capable of breaking them exists yet". This work is that code, so rule 1
enters the file with it. What is tested is `confirmable` in `src/lib/captures.ts`: a pure
function, because the rule is about a decision and not about a status code, and kept inside the
route it could only be checked by standing up a database, a session and a Google account.

**The deduplication rule lives in two places.** `src/lib/captures.ts` holds it now, and
`src/mastra/workflows/resolve-conflict.ts` still has its own copy in the `interpret` step.
Pointing the workflow at the shared one is a few lines and was left out to keep this change away
from the state machine. It is duplicated knowledge until somebody does it.

**CI does not run the tests.** `.github/workflows/ci.yml` runs typecheck, lint and build.
CLAUDE.md says the guardrails block the merge, and today nothing on a neutral machine checks
that. Adding the two test steps is small and belongs to whoever touches CI next.
