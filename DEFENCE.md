# Norma findings: what we did about them

Norma (QualityClouds) flagged four categories of finding against this codebase. Each one was checked against the real code before acting on it — a raw finding is a claim, not a verdict — and this is the full account, not just the parts that make a good story.

Norma's own MCP wasn't reachable from inside the session that did this work (it needs an OAuth authorisation this project's automated sessions can't complete). Everything below was verified by reading the flagged code directly and reasoning about it, the same way any other review would.

---

## 1. What we fixed

### Async operations without error handling

Two of this project's own API routes, `src/app/api/transcribe/route.ts` and `src/app/api/structure-plan/route.ts`, only guarded their *first* call to an external service (SLNG, Nebius). Every step after that — reading a response body, polling a batch job to completion, downloading the result, parsing a model's JSON output — could throw past the route's own `try/catch` on a malformed response or a network blip, and take the whole request down with an unhandled exception instead of a clean error.

Fixed: every one of those steps now has its own `try/catch`, its own log line naming what failed, and its own clean `NextResponse.json` error. Confirmed by reading both routes end to end after the change — no `await` on an external response sits outside a guard.

A related, unhandled-server-component-failure gap in `src/app/page.tsx` and `src/app/offload/page.tsx` (both call `currentPerson()`, which can throw if the database connection drops) was closed with a root `src/app/error.tsx` — Next.js's own mechanism for exactly this class of failure — rather than a `try/catch` copy-pasted into every server component. One boundary, not a pattern to remember to repeat.

### Network requests without timeout

No `fetch` call anywhere in the project — this app's own routes or a direct call to a third party — had a timeout. A service that accepts a connection and never answers would leave a person watching a spinner with no way out, and would tie up a server request handler indefinitely for nothing.

Fixed with one shared utility, `src/lib/fetch-with-timeout.ts` (`AbortController` under the hood, a per-call timeout instead of one fixed value, and `isTimeout(error)` so callers can show a distinct "that's taking too long" message). Applied everywhere a `fetch` call existed at the time: both screens of the phone sign-in flow, the Silent Auth return screen, the two calls `src/app/offload/page.tsx` makes to this app's own routes, all the calls `/api/transcribe` and `/api/structure-plan` make to SLNG and Nebius, and the three calls in `src/lib/google.ts` to Google's OAuth endpoints. Each timeout is sized to what the call actually does — a status check isn't given the same budget as uploading audio or waiting on a language model.

One exception, by design and not by omission: `src/lib/sms.ts` reimplements the same `AbortController` pattern inline instead of importing the shared utility, because that file is deliberately import-free so `npm run test:unit` can run it directly with plain `node --experimental-strip-types`, which doesn't resolve this project's `@/` path alias.

Found afterwards, during a second, self-directed pass over a later feature (the SMS support-network invite) built after this fix landed: `src/lib/sms.ts`'s own call to Vonage had no timeout either, and `src/app/api/room/guest/[token]/route.ts`'s two database calls weren't wrapped in a `try/catch`. Both fixed the same way as everything above, before either shipped.

### A real unmount gap in a `useEffect`

Raised as a specific example under the "synchronous `setState` inside `useEffect`" category (see below for why the category itself found nothing else): `src/components/verification-return.tsx` called `setOutcome(...)` after an `await fetch(...)` with no guard against the component having unmounted in the meantime — if someone navigated away from that screen while the Silent Auth check was still in flight, the state update would land on a component that was already gone.

Fixed with the standard pattern: a `cancelled` flag set in the effect's own cleanup function, checked before every `setOutcome` call that runs after an `await`.

---

## 2. What we didn't fix

- **`src/app/offload/page.tsx:57` and `:67`** (inside `structurePlan()`, now `src/app/offload/OffloadFlow.tsx` after a later reorganisation) — the two `await`s Norma flagged as unhandled inside that function.
- **`src/app/offload/page.tsx:110`** (a `.forEach()` calling `track.stop()`) — flagged as "Array.forEach() with async callback".
- **The "synchronous `setState` inside `useEffect`" category as a whole**, everywhere except the one line in `verification-return.tsx` listed above.

---

## 3. Why we didn't fix it

**The two `structurePlan()` `await`s**: already handled, one call frame up. `structurePlan()`'s only caller wraps the call in its own `try/catch` and shows an error message on failure — confirmed by reading that call site directly. Wrapping the two `await`s a second time, *inside* the function as well, would have been a redundant, do-nothing `catch` sitting on top of a `catch` that already does the real work. Norma's finding is correct that the lines it points at have no local error handling; it just doesn't see that the caller already provides it, which a purely lexical, per-function scan can't.

**The `forEach` with an "async callback"**: not async. `MediaStreamTrack.stop()`, the method being called, is a synchronous browser API — it returns `undefined`, not a `Promise`, and there is no asynchronous operation in that callback to fail to handle. This is a plain false positive: the finding's premise (an async callback inside the loop) doesn't hold for this specific call.

**The `useEffect` category, generally**: a full read of every `useEffect` in the project (six call sites, at the time this was checked) found every `setState` inside one either already deferred — via `setTimeout`, `queueMicrotask`, or resolved inside an async function's own callback — or, in one case, not a React state update at all (a Motion `useSpring` value, set specifically so moving the mouse doesn't trigger a React render on every frame, which the component's own comment already explains). None of those match the pattern the finding describes: a `setState` called synchronously, in the immediate body of the effect, on every run. The one real problem this category did surface — the unmount gap in `verification-return.tsx` — wasn't this pattern either; it was found by asking "what does this line actually risk", not by matching the finding's literal description, and is recorded as fixed above rather than here.
