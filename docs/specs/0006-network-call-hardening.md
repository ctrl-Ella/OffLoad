# 0006 — Every network call fails loud and fails on time

| | |
|---|---|
| **Status** | Implemented |
| **Area** | backend |
| **Issue** | #35 |
| **Date** | 2026-09-20 |

---

## Problem

Two of this project's own server routes — `/api/transcribe` and `/api/structure-plan` — only
guarded their first call to an external service. Every step after that (reading the response
body, polling a batch job, downloading the result) could throw on a malformed response or a
network blip and take the whole request down with an unhandled exception instead of a clean
error.

Separately, no `fetch` call anywhere in the project — client or server, this project's own routes
or straight to SLNG, Nebius and Google — had a timeout. A service that accepts a connection and
then simply never answers leaves a person watching a spinner with no way out, and, on the server
side, ties up a request handler indefinitely for nothing.

Neither had ever caused a visible failure in the demo. Both are found by reading the code that
talks to the outside world, not by reproducing a crash — this is hardening ahead of relying on
these calls under real network conditions, not a fix for something that broke.

---

## Acceptance criteria

- [x] Every step of `/api/transcribe` and `/api/structure-plan` that reads or parses an external
      response is guarded, with its own log line and its own clean JSON error — no step can throw
      past its route's `try/catch` boundary
- [x] `verification-return.tsx`'s async check no longer sets state after the component might have
      unmounted mid-request
- [x] Every `fetch` call in the project — the app's own API routes and third-party services alike
      — gives up after a bounded time instead of waiting indefinitely, and the person sees a
      distinct "that's taking too long" message where the calling code can tell a timeout apart
      from an ordinary failure
- [x] A server component's own top-level failures (`currentPerson()` losing its database
      connection, mainly) show a real error screen instead of Next's default one

---

## Scope

**Granular error handling in `/api/transcribe` and `/api/structure-plan`**, matching the pattern
this project's sign-in routes already used correctly: each risky step — response parsing,
`JSON.parse`, schema validation, every step of the batch-job poll loop — in its own `try/catch`,
with a log line naming what failed and a clean `NextResponse.json` error, not a bare rethrow.

**An unmount guard in `verification-return.tsx`**: a `cancelled` flag set in the effect's cleanup,
checked before every `setOutcome` that runs after an `await`.

**One shared timeout utility**, `src/lib/fetch-with-timeout.ts` — `fetch` wrapped in an
`AbortController`, a per-call timeout instead of one fixed value, and `isTimeout(error)` so
callers can show a distinct message. Works identically client-side and server-side, so it
replaced the one-off version already built for the voice flow rather than living twice.

**Applied everywhere a `fetch` call existed**: both screens of the phone sign-in flow, the
Silent Auth return screen, both of this project's own routes calling SLNG and Nebius, and the
three calls in `src/lib/google.ts` to Google's OAuth endpoints. Each call's timeout is sized to
what it actually does — a status check isn't given the same budget as uploading audio or waiting
on a language model.

**A root `error.tsx`**, Next.js's own boundary for whatever a server component throws while
rendering, covering every route under `app/` that doesn't define its own.

---

## Out of scope

**Retrying a failed or timed-out call.** Every guarded step fails clearly and says so; none of
them retries on its own. Whether a retry belongs here, and how many times, is a decision for
whoever next has a reason to make a specific call more resilient than "fail and let the person try
again."

**A global fetch wrapper enforced by lint or a custom `fetch` override.** `fetchWithTimeout` is
opt-in, called explicitly where it's used. Nothing prevents a future call site from reaching for
bare `fetch` again; that's a process question, not this pass's job.

**Timeouts tuned against real production latency.** Every figure here comes from what this
project already measured or documented about each service (SLNG's batch API, Nebius's structured
output, the sign-in flow's own Vonage and Google calls) — reasonable starting points, not numbers
validated under load.

**Every `await` in the codebase.** The audit covered all of them (17 files), but the two fixed
here — the parsing steps in the two newest routes, and the one unmount gap — were the only real
gaps found. The rest, especially the sign-in flow, already handled errors correctly and needed no
change; that's recorded as a finding, not silently skipped.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| One `fetchWithTimeout` in `src/lib/`, used by both client components and server routes | A version per environment, or keeping the one already local to the voice flow | `AbortController` isn't environment-specific, and this project's own code conventions call a second copy of the same thing the way consistency stops holding. Extracting it once the same need showed up a third time was cheaper than arguing for a shared file before it existed |
| Each external-response step in `/api/transcribe` and `/api/structure-plan` gets its own `try/catch`, matching the sign-in routes' existing style | One `try/catch` around the whole handler | This project's own routes had already settled the pattern: a single wide `try/catch` can't say which of five different network calls failed, and each of these routes talks to a different upstream at each step |
| A timeout value per call, not one constant for the whole project | A single shared default everywhere | A status-poll and a base64 audio upload don't fail on the same clock. Nebius and SLNG both have documented latencies this project already measured; using them beats picking one number for everything |
| `verification-return.tsx` gets a `cancelled` flag, not `AbortController` on its own `fetch` | Aborting the in-flight request on unmount | The request itself doing useful work (writing to `verification`, opening a session) if it completes right after unmount is not wasted the way an abandoned GET would be; the flag only stops a state update from landing on a component that's gone, which is the actual problem — cancelling the request outright would also cancel work worth finishing |
| A root `error.tsx` rather than a `try/catch` in every server component | Wrapping `currentPerson()` in `page.tsx` and `OffloadFlow`'s `page.tsx` individually | Next.js already has a mechanism for exactly this failure class, and using it once covers every route under `app/` including ones that don't exist yet, instead of a pattern someone has to remember to repeat |

---

## Contract

**New file**: `src/lib/fetch-with-timeout.ts`, exporting `fetchWithTimeout(input, init?, timeoutMs?)`
(default 15s) and `isTimeout(error): boolean`.

**New file**: `src/app/error.tsx`, a client component receiving Next's standard `{ error, reset }`
props.

**No API route's request or response shape changed.** This is entirely about how failure is
handled, not what success looks like.

---

## Verification

```bash
npm run typecheck
npm run lint
npm run dev
```

1. `curl -X POST localhost:3000/api/structure-plan -H "Content-Type: application/json" -d '{"transcript":"..."}'` — still returns the same shape as before this work.
2. Record a real message through `/offload` end to end — still reaches the review screen.
3. Sign in by phone, end to end — still works, including the silent-auth return screen.
4. Read through both modified routes and confirm every `await` on an external response sits
   inside a `try/catch` with its own log line.

No test forced a real timeout or a real mid-flight unmount — both are edge cases that need either
a deliberately slow upstream or manual timing to reproduce, and neither was staged for this pass.
The guards are verified by reading, not by triggering them live.

---

## Notes

**This spec, like the two before it, was written after the code.** The work came from walking a
static-analysis report finding by finding during a live session, verifying each one against the
actual code before acting on it — several flagged lines turned out to already be handled correctly
one call frame up, or weren't async at all, and are recorded as false positives rather than
"fixed" for the sake of matching the report.

**The false positives, so nobody re-investigates them:** a `forEach` calling
`MediaStreamTrack.stop()`, which is synchronous and was never an async callback; and two `await`s
inside `structurePlan()` (`OffloadFlow.tsx`) that the report flagged in isolation without seeing
that its one caller already wraps it in its own `try/catch`.
