# 0002 — Voice entry: from a spoken message to a reviewable plan

| | |
|---|---|
| **Status** | Implemented |
| **Area** | ia |
| **Issue** | #NN |
| **Date** | 2026-09-20 |

---

## Problem

The listening screen exists but does nothing real: it records a gesture, plays a scripted
example sentence word by word, and stops there. Nobody's actual voice ever reaches it, and
nothing it shows can be acted on.

Saying something out loud — a mix of appointments, errands and reminders — should come back as
a plan a person can look at and decide about: what got heard, split into events and tasks, with
any real scheduling collision between them called out before anyone confirms anything.

---

## Acceptance criteria

- [x] Recording through the listening screen captures a real `MediaStream` and sends it to a
      real transcription service; nothing on screen is a scripted or simulated transcript
- [x] The waveform reflects the actual signal level from the microphone while recording, not a
      random simulation
- [x] The transcript is turned into a list of events and tasks, each with its own date/time or
      due label, not left as raw text
- [x] Two events whose time ranges overlap are flagged as a conflict, computed from their
      timestamps — never by asking a language model whether they collide
- [x] The person sees the result on a dedicated review screen, with nothing written anywhere yet
- [x] Denying microphone permission, recording silence, and a failed transcription or structuring
      call each show their own message, in Mia's voice, telling the person what happened
- [x] The whole flow works with the keyboard alone, with focus visible at every step, at 200%
      zoom and in mobile landscape
- [x] `prefers-reduced-motion` is honoured by the orb's pulse, its processing animation and the
      transcribing spinner

---

## Scope

**Recording and metering**, in `src/app/offload/page.tsx`: `getUserMedia` with echo
cancellation, noise suppression and auto gain **off** (see Decisions), `MediaRecorder` on the
resulting stream, and a Web Audio `AnalyserNode` on the same stream feeding 27 real level
readings to the waveform every 120ms.

**Two server routes**, because the two keys they hold can never reach the browser:

- `POST /api/transcribe` — takes the recording, calls SLNG's batch speech-to-text API, and
  returns the transcript.
- `POST /api/structure-plan` — takes the transcript, calls Nebius to extract events and tasks
  with real timestamps, computes conflicts in plain TypeScript, and returns the combined list.

**Four screen states**, one flow: idle (microphone icon, nothing recorded yet) → listening (live
waveform, real levels) → transcribing (shared by both server calls — "Sorting it out", since from
the person's side both are the same wait) → reviewing (the structured plan) — with an error state
reachable from any of the first three, each with its own message.

**The immersive dark surface**, as a first-class part of the design system: a `── immersive`
section in `src/app/styles/tokens.css`, contrast-measured the same way as every other token in
that file, not a separate stylesheet with its own palette.

---

## Out of scope

**Writing anything to a calendar or task list.** Rule 1 — nothing is ever written without human
confirmation — and this work stops one screen before that confirmation exists. "Review the plan"
does not yet do anything past showing the plan; it links to `/plan`, which does not exist yet.

**The Mastra `resolveConflict` workflow.** No Mastra workflow, agent or tool exists anywhere in
this codebase yet. Both server routes call SLNG and Nebius directly. This is the vertical slice
that proves the shape of the data before it moves into the workflow described in `CLAUDE.md`;
folding it into a persisted state machine is separate work.

**Real-time or streaming transcription.** The person records, stops, and waits — the transcript
does not grow word by word while they speak, unlike the mockup's original visual concept. SLNG's
only working Spanish speech-to-text model is asynchronous batch, not streaming HTTP (see
Decisions), so a wait screen replaced a live transcript.

**Editing a structured item, or resolving a conflict from this screen.** The review screen shows
what was understood. Changing a time, splitting an item, or deciding which of two colliding
plans wins is a later screen's problem.

**Anything inside a video call.** Live Captions, the SIP bridge and Vonage's three states of Mia
belong to the `call` lane and share no code with this.

**Any language other than Spanish for what Mia hears.** The interface text in this flow is
English (see Decisions); the `language=es` sent to SLNG is not connected to that and does not
change with it.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| Speech-to-text goes through `slng/speechmatics/batch:15.0.0`, on SLNG's separate batch API (`api.batch.slng.ai`) | `deepgram/nova:3` on SLNG's per-provider gateway, the model this project's own documentation recommended | `deepgram/nova:3` accepts `language=es` without error and silently never transcribes Spanish — confirmed against four separate clips, three of them real recorded speech, all returning `confidence: 0.0` despite correct duration and channel counts every time. Its dedicated Spanish and multilingual deployments exist in SLNG's catalogue but return `503 No deployments found` in every region that exists. The batch API's Speechmatics model is undocumented at the page level (every relevant `docs.slng.ai` page 404s) but real and working — found by reading its raw OpenAPI spec at `docs.slng.ai/api-reference/batch/batch.oas.json`. Full trail, including the exact requests that proved each step, is in `.claude/skills/platform-docs/SKILL.md` |
| Batch recording (record fully, then send) | Streaming transcription over WebSocket, matching the design mockup's word-by-word growing transcript | The only Spanish-capable SLNG model with a synchronous, low-latency path is WebSocket-only (`soniox/speech-ai:rt-v5`), which trades a working batch call for real streaming-audio plumbing this weekend cannot afford to debug twice. A "Sorting it out" wait screen replaced the live transcript instead |
| The server route polls the batch job to completion before responding | Returning the job id immediately and having the browser poll | This project's own architecture note says a process of unpredictable inference time does not belong behind a short-lived request — but no long-lived worker exists yet either. Polling inside the route (up to 40 attempts, 1.5s apart) is the smallest change that works today; moving the wait into an actual persisted job is Mastra's job once it exists |
| Nebius extracts structured events and tasks only; every conflict is a pairwise time-range overlap check in TypeScript, run after the model responds | Asking the model directly whether two items conflict | This project's stated thesis: working out that two things collide is arithmetic over times, and a language model never gets asked a question a deterministic computation can answer. The model's schema has no `conflict` field of any kind |
| `Qwen/Qwen3-30B-A3B-Instruct-2507`, the small tier, called directly against the Token Factory API | A larger/negotiator-tier model, or the model already used elsewhere in the codebase | Pure extraction — title, event/task split, real timestamps — is exactly what the small tier is for. Measured against two other live candidates for structured-output reliability the same day: one dropped a field, one produced malformed dates; this one did neither and was also the fastest of the three |
| The listening screen's on-screen text (titles, captions, `aria-label`s) is English | Spanish, matching the rest of the interface | A deliberate, explicitly confirmed exception for this one flow, decided before the rest of the interface's English-language convention existed. What the person actually said, and everything the API returns from their own words, stays in Spanish regardless — only the screen's own chrome is English |
| Echo cancellation, noise suppression and auto gain control are explicitly turned off on the captured stream | The browser's defaults (all three on) | Tuned for voice calls, not dictation. On this project's own test hardware they measurably degraded real speech enough to produce an empty transcript from otherwise correctly-captured, correctly-durationed audio — diagnosed by logging what SLNG actually received against what was spoken |
| The immersive dark tokens live in `src/app/styles/tokens.css`, in their own commented section, reusing the brand's teal and onyx where the numbers hold | A separate stylesheet scoped to this route, with its own colour names | This repository already paid for that mistake once — a `review-plan` prototype shipped with a stylesheet full of colour names that were never real tokens, silently broken the moment it merged. One token file, one set of names, each with its contrast written down next to it |

---

## Contract

**Routes:**

| Route | Request | Response |
|---|---|---|
| `POST /api/transcribe` | `multipart/form-data`, field `audio` (the recorded clip) | `{ transcript: string }` |
| `POST /api/structure-plan` | `application/json`, `{ transcript: string }` | `{ items: PlanItem[] }` |

```ts
type PlanItem = {
  title: string;
  detail: string;                              // e.g. "jue 18:30 – 19:30", "antes del jueves"
  type: "event" | "task" | "conflict";
};

type ListeningStatus = "idle" | "listening" | "transcribing" | "error";
type PageStatus = ListeningStatus | "reviewing";   // offload/page.tsx's full state machine

type OrbState = "idle" | "listening" | "processing" | "success"; // ListeningOrb's own states
```

**New environment variable**, `.env.example`:

```bash
# Small tier: cheap extraction, not the negotiator's own reasoning. Used by
# /api/structure-plan to pull events and tasks out of a transcript.
NEBIUS_MODEL_SMALL="Qwen/Qwen3-30B-A3B-Instruct-2507"
```

`SLNG_API_KEY` already existed in `.env.example`; this work is what first gives it something to
authenticate.

**New immersive tokens**, `src/app/styles/tokens.css`: `--color-surface-immersive`,
`--color-ink-immersive`, `--color-ink-muted-immersive`, `--color-accent-immersive`,
`--color-border-immersive`, `--color-card-immersive`, `--color-chip-immersive`,
`--color-alert-surface-immersive` — each measured against `--color-surface-immersive`, with the
figure written next to it in the file.

---

## Verification

```bash
npm run typecheck
npm run lint
npm run dev
```

1. Open `/offload`, grant microphone access, tap the mic.
2. Say something with two overlapping times and at least one task — for example: *"Recuerda que
   el jueves a las seis y media tengo la reunión de producto, y ese mismo jueves a las seis y
   media hay que recoger a Leo, y antes del jueves hay que hacer la compra."* Tap again to stop.
3. Watch the waveform move with real speech and go flat during silence.
4. Expect "Sorting it out" for roughly 15–45 seconds (SLNG's batch API is not instant), then a
   review screen with two events, one task, and a fourth card of type "Conflict".
5. Deny microphone permission once: expect the permission-denied message, not a silent failure.
6. Record silence: expect "I didn't hear anything."
7. Walk the whole flow with `Tab` and `Enter` alone, at 200% zoom, and with the OS's reduced-motion
   setting on — the orb's pulse and processing dots must hold still without disappearing.
8. `curl -X POST localhost:3000/api/structure-plan -H "Content-Type: application/json" -d '{"transcript":"..."}'`
   directly, to check the route without recording anything, and to see `items` include a
   `"conflict"` entry when two events' times genuinely overlap and none when they do not.

---

## Notes

**This spec was written after the code, not before.** Three branches — this one, the review-plan
screen, and the stylesheet reconciliation — were built in parallel during the hackathon and
merged together once all three existed. The project's own order is issue, then spec, then code;
this is the exception being written down rather than left unspoken.

**`dueLabel` extraction is not perfect.** "Antes del viernes" round-tripped once as `"viernes"`,
losing the "before". A model-extraction nuance, not a schema bug — worth another look once more
real transcripts have gone through it.

**Two small pre-existing bugs surfaced and got fixed while building this**, unrelated to voice
entry itself: `src/app/layout.tsx`'s skip-to-content link pointed at colour variables
(`--color-fondo`, `--color-texto`) that no longer existed anywhere after the stylesheet
reconciliation, and its `href="#contenido"` never matched any screen's actual `id="content"`.
Both now use the real tokens and the real id.

**One question left open for whoever builds `/plan`:** this flow ends at "Review the plan"
linking to a route that does not exist. What happens when someone taps it — confirm each item
individually, confirm the whole batch, or something else — is that screen's decision, not this
one's.
