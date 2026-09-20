# Changelog

What changed in OFFLOAD, newest first.

Every pull request adds a line here before asking for review. It is on the template's checklist, and the reason is that a log written at the end of a project is written from memory — and memory at three in the morning invents things.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the change types match the ones we use for commits.

---

## Unreleased

### Added

- The yes to «¿Llamo a alguno?» now leads somewhere: the screen that pressed **Call** lists the support network, pressing a name sends the same invitation spec 0009 sends for a spoken «invita a Marta», and the guest's video takes its place beside the other core person's instead of under it. The seed writes the support network's numbers, so an invitation can actually go out.
- The yes that puts something on a calendar: what is dictated to Mia is saved as a capture, the review screen offers **Add to calendar** on the rows that really can go on one, and `POST /api/captures/[id]/confirm` writes the event and records the id Google gave it. Pressing twice books one afternoon, not two. Rule 1 enters `npm run test:guardrails`, checked on `confirmable` in `src/lib/captures.ts`.
- A clash card leads somewhere: it links to that clash's day on `/conflict`, which now reads `?day=` instead of only ever looking at today.
- The family calendar on the home screen shows what is on the core circle's real Google calendars, the week before and after this one, with today selected, the stops of a clash marked, and the foot saying whose calendar could be read. An expired Google grant is told apart from a Google that did not answer, and the button to connect again sits right there.
- The clash screen and the video call: the day is read from Google Calendar and the unconfirmed captures, the clashes are worked out by arithmetic in `src/lib/conflicts.ts` with its unit tests, `/conflict` shows the first one full screen with the two ways out, and `/call` opens the household's Vonage room with live captions and Mia's tile. The home screen says whether something clashes and whether a call is open.
- Mia inside the call: the `resolveConflict` workflow on Mastra with its two agents, rule 3 as code with `npm run test:guardrails`, the run that reads both calendars when the room opens and waits for the call, the deterministic moment she asks for the floor, her clip through SLNG, and the yes-or-no card that resumes the run on either screen.
- `npm run bench:agents`: the two agents measured through the product's own functions, with the cases in `bench/cases/` and the results beside them. On 2026-09-20 the interpreter is right 28 times in 30 and the negotiator 6 in 6, inventing nobody's availability.
- The Nebius benchmark, in `bench/`: 36 real product cases, the five-model comparison from 2026-09-18 and the fourteen result files behind it, plus `npm run bench:transcribe` to turn the recorded sentences into transcripts through the product's own route. It arrives as a standalone npm package, with the three defects that blocked the voice measurement fixed.
- The demo week on the core circle's real Google calendars: `npm run demo:seed`, `demo:clear` and `demo:show`, with the week in one editable file. Every event carries a private marker, so the commands never list or delete what the family added by hand.
- Mia, the character, with her five states and her voice: the drawing on the door and on a `/system` reference page, her colour tokens, the SLNG synthesis call with its environment contract, and `npm run mia:say` to hear her from the command line.
- Initial database migration: seven tables and the `Circulo` enum, generated with `migrate diff --from-empty` so the SQL could be reviewed before it was applied.
- Production image and Railway deployment guide: a four-stage `Dockerfile` with an unprivileged user, `.dockerignore`, Next's `standalone` output and the `/api/health` route.
- Repository README, with status badges for continuous integration, open issues and open pull requests.
- Application skeleton: TypeScript, Next.js, Tailwind and ESLint configuration, the Prisma schema and a placeholder page. With this the project builds and deploys.
- Project scaffolding: instructions for Claude Code sessions, one agent per lane, the working process, issue and pull request templates, labels and continuous integration.

### Changed

- The clash screen and the video call join the application's design. Both had written their own chrome — a bare `OFFLOAD` in text, a back arrow, no navigation, a narrow column on the cream background — and next to the home screen's white page, wordmark and pill buttons they read as a different product. They now use `AppNavigation` and the presentation language. The video room keeps its dark canvas, which is a designed surface with its own measured contrast.
- Every Vonage variable says which application it belongs to. The video set becomes `VONAGE_VIDEO_APPLICATION_ID`, `VONAGE_VIDEO_PRIVATE_KEY_PATH` and `VONAGE_VIDEO_PRIVATE_KEY`, and the key file `video.key`. Verify already had its prefix and video did not, so video read as "the Vonage application" — and the two keys are not interchangeable. Nothing on the voice side is renamed.
- Every screen is English, by team decision: the door, the sign-in, the home screen, `/system`, Mia's state labels and the card's buttons. What Mia says out loud stays Spanish. The rule is written in `CLAUDE.md`.
- The whole project moves to English: rules, documentation, code comments, templates, labels, agent instructions and product copy.
- Required pull request approvals drop to zero on `main` and `dev` for the duration of the hackathon. A pull request and green CI are still enforced. Another person reviewing stays the team's agreement, now with no machine checking it.

### Fixed

- Mia never asked for the floor inside the call, whatever anyone said. The chain from the caption to her raised hand was complete; what was missing was something for her to say. `listenToTheCall` only suspends the run when the day holds a clash, and the demo week held none, so every transcribed line was answered with "no day looked at" and nothing on screen said so. The demo week now carries the clash it was written for — Elvia leaves Zona Franca at 18:30 and the pool in Nou Barris starts at 19:00, thirty minutes for a trip of thirty-five — and the seed writes the support network, without which the card that asks whether to call anyone is dropped before it is built.
- Two people joining the room seconds apart could leave the first one talking to a Mia who had started over: the look at the day skipped its own work only after the earlier run had reached its suspension, so whoever arrived first had their run deleted mid-flight. The looks are queued now.
- Captions that failed to start were logged as information, which is what made the silence unreadable: a call where Mia hears nothing looks exactly like a quiet one. The failure is a warning now, a 409 stays information because it is the second person entering, and the room says "No captions yet" when none has arrived — with the button to ask Mia to step in, which only appears in that case.
- Signing out was being pressed as "I'm leaving", and it deletes the session row: the next visit asked for the phone number again although the cookie lasts thirty days. The account menu now says what signing out costs before doing it, and both headers share one `AccountMenu` so the confirmation cannot fall out of step between them.
- The registered Google redirect URI was documented as `/api/auth/google/callback` in `.env.example` and in spec 0001, and the code uses `/api/auth/callback/google`. Following the documentation earned a `redirect_uri_mismatch` and no way in.
- `.env.example` was missing `TEST_EMAIL_ELVIA` and `TEST_EMAIL_CARLOS`, which the seed has always read, so a fresh copy of it could not seed. It now carries them alongside `TEST_PHONE_NICOLAS`, `TEST_PHONE_ROSA` and `TEST_PHONE_MARTA`: five values to fill before `npm run db:seed`, which names the ones it does not find.
- Times dictated to Mia were parsed without a timezone, so half past six in Madrid was read as half past six in London on a container running in UTC. The offset now comes from the day itself, through `clock.ts`.
- Four things dictated at the same hour produced six clash cards saying the same thing. `/api/structure-plan` had its own pairwise detector; it now calls `conflictsForOnePerson`, the one with tests behind it, which reports the problems in a row rather than one card per pair.
- Continuous integration was failing when generating the Prisma client. `prisma.config.ts` resolves `DATABASE_URL` as it loads, so the placeholder value moves to the job level instead of only the build step.
