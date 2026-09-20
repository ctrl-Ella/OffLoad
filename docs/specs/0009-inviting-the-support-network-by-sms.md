# 0009 — Inviting the support network into the call, by SMS

| | |
|---|---|
| **Status** | Implemented |
| **Area** | backend · video |
| **Issue** | #43 |
| **Date** | 2026-09-20 |

---

## Problem

Once Elvia and Carlos are on the call, the negotiator can decide the right answer is asking someone in the support network — but today nobody can act on that inside the call itself. There is no way to bring Nicolás, Rosa or Marta in: `/api/room/route.ts` hard-blocks anyone whose `circle !== "CORE"` with a 403, and there is no other door. Reaching them means hanging up and phoning them separately, which defeats the point of deciding this on video.

Two things now make this closable. `Person.phone` exists (this session's earlier change) so a real number can be texted. And a spoken command inside the call — "Mia, invita a Rosa" — is exactly the kind of thing this call's listening pipeline already turns into an action, the same way it already turns "no puedo" said twice into Mia raising her hand.

---

## Acceptance criteria

- [ ] Saying "invita a Rosa" or "que se una Nicolás" inside the call, with that person in `people` as `SUPPORT` with a phone number, results in an SMS actually accepted by Vonage
- [ ] Saying an invite phrase that names nobody in the support network, or names someone ambiguously, sends no SMS and both screens show a plain notice that Mia did not catch who
- [ ] The confirmation "Invited Rosa to the call" appears on both core screens only after Vonage's response says the message was accepted — never before, and never if it failed
- [ ] The SMS link opens `/join/[token]` without any sign-in and puts the guest into the same Vonage session as a `publisher`, never a `moderator`
- [ ] The link stops working after it expires; a stale or tampered token is rejected with a plain sentence, not a stack trace
- [ ] Saying the same invite phrase twice in a row (which happens by construction — both core browsers relay every caption they hear) sends exactly one SMS
- [ ] The SMS text names nobody's availability and does not claim anything not yet true
- [ ] No log line carries a phone number, the guest link's token, or the SMS body
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:unit` and `npm run build` pass
- [ ] Nothing under `src/mastra/agents/` is touched

---

## Scope

**Detecting the command**: `src/mastra/listening.ts` gains `isAnInviteCommand` (cheap, checked on every caption before anything touches the database) and `matchInvitedPerson` (matches a name against the support network, exact-enough and accent/case-insensitive, reusing `flatten`).

**Sending the SMS**: `src/lib/sms.ts`, a from-scratch call to Vonage's SMS API (not the video application's JWT — see Decisions). `src/lib/invite.ts` composes Mia's fixed message and confirms the invite once Vonage has answered.

**The guest link**: `src/lib/guest-link.ts`, a signed, short-lived token tying one support-network person to one Vonage session. `GET /api/room/guest/[token]`, which hands out a `publisher` session token to whoever presents a valid one — no cookie, no sign-in.

**The guest screen**: `/join/[token]`, and `src/components/GuestRoom.tsx`, a deliberately smaller relative of `Room.tsx` — video tiles and call controls, no Mia, no proposal card.

**Wiring**: `src/app/api/room/heard/route.ts` runs the detector on every final caption and triggers the invite in the background. `src/lib/household.ts` gains `supportNetwork()`. `src/lib/env.ts` gains the SMS credentials and the guest-link secret. `src/components/useRoom.ts` is generalised in two small ways so `GuestRoom` can reuse it: a configurable room-key endpoint, and a generic signal callback that carries the signal's type.

**The confirmation**: `Room.tsx` listens for a new `"invite"` signal and shows a transient, plain-text line — reusing `sendSignal`, not a new mechanism.

---

## Out of scope

**The SIP bridge.** This is a second, independent way in for the support network — over a browser link, no phone call, no number to dial. Spec 0005 already named the SIP leg as the call lane's next piece; it stays that.

**A third video tile.** `Room.tsx` renders exactly two: mine and "theirs", and every stream that is not mine gets appended into the same slot. A guest joining a call that already has both core people in it means three streams stacked in one tile. Fixing the room's layout for three or more participants is a separate, general problem this spec does not solve.

**The guest's own speech reaching the negotiation.** It does not need new wiring to reach Mia's ears: once the guest is a normal Vonage publisher, both core browsers already subscribe to their stream and already relay every final caption they hear to `/api/room/heard`, exactly as they do for each other. What the workflow *does* with a third voice in the transcript is the negotiator's concern, not this spec's — untouched, under `src/mastra/agents/`.

**Naming who spoke the command.** `/api/room/heard` cannot tell which of the (up to three) people in the room said the sentence — every browser relays every stream's captions, so the same line can arrive from either core person's session. The SMS and the confirmation therefore never say who asked; only that Mia was asked.

**Seeding the support network for a live test.** No Postgres is reachable in this environment, so this could not be exercised end to end regardless. `docs/decisions/0003-person-phone-in-the-clear.md` already says this is done by hand against the seed data; that stands.

**A delivery receipt.** "Accepted by Vonage" is the bar this spec meets (see Decisions on rule 4). Confirming the text actually reached the phone needs a webhook, which is a different, larger commitment this feature does not need to make.

**The echo-cutting speaker toggle `Room` has.** `GuestRoom` ships mic, camera and leave only. A guest joining from their own phone, away from the household, has no echo to cut; the control exists in `Room` for two devices sharing one table, which is a core-only situation this spec does not extend.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| The SMS API is called with the account's API key and secret over Basic auth | Signing it the same way as video, with the application JWT | Checked against the Vonage documentation MCP on 2026-09-20: the SMS API only understands Basic auth over `rest.nexmo.com`; there is no JWT-authenticated form of it. `CLAUDE.md`'s "everything goes through JWT" rule exists because Basic auth cannot carry a webhook and this project depends on webhooks — but confirming an SMS needs no webhook, because Vonage's own synchronous response already says whether it accepted the message. This is a narrow, documented exception, not a quiet departure from the rule |
| `VONAGE_SMS_API_KEY` / `VONAGE_SMS_API_SECRET`, new and explicitly named | Reviving the unqualified `VONAGE_API_KEY` / `VONAGE_API_SECRET` spec 0008 found sitting unused on Railway | Spec 0008 called those two "leftovers from an auth model this project does not use" and left deleting them as a separate call. They are exactly the credential this feature needs, but spec 0008's own naming rule — every Vonage variable says which purpose it serves — argues for a fresh, explicit pair rather than assuming the old ones still hold the right values or scope |
| `VONAGE_NUMBER` is the SMS sender | A new `VONAGE_SMS_NUMBER` | The task this variable was reserved for — is exactly this one, "the number Nicolás's SIP leg comes in on" doubling as a texting number. A real Vonage virtual number carries both capabilities; a second number for the same feature would be inventing a distinction Vonage itself does not make. Its `.env.example` comment is updated so it stops reading as unused |
| A real E.164 number as the sender, not an alphanumeric sender ID | An alphanumeric ID like `"OFFLOAD"` | The platform-docs skill records that Spain now requires every alphanumeric SMS sender ID to be registered with the CNMC as of 2026-09-15. A real number sidesteps that requirement entirely, and Vonage's own error code 15 ("Invalid Sender Address") is otherwise common outside North America too |
| The trigger phrase list is two entries, `"invita a"` and `"que se una"` | A longer list covering more ways to phrase an invitation, or a model call | Mirrors `REFUSALS`' own reasoning: a short, curated list keeps false positives rare, and every false positive here costs a real SMS to a real phone, not just a missed beat in a negotiation. `CLAUDE.md` already rules out a third agent for exactly this kind of pattern match |
| A name is matched on the *last* word of the person's stored name | Matching the whole stored name, or any of its words | The support network's rows are stored with a role prefix — `"Abuela Rosa"`, `"Vecina Marta"` per the demo fixtures in `tests/guardrails.test.ts` — but a person says "invita a Rosa", not "invita a Abuela". Matching on the last word matches how the name is actually said; matching on every word risks "abuela" alone triggering a match with no name spoken at all |
| Zero matches and more than one match both come back as "no confident match" from `matchInvitedPerson` | A three-way result that tells ambiguous apart from unmatched | Either way Mia cannot say a name back with confidence, and the caller's response is identical in both cases: say nothing was sent and why. A finer-grained type would exist for no caller to read |
| The invite command is detected independently of whether a workflow run is waiting for the call | Folding it into the existing `bothHaveRuledItOut` gate | Inviting the support network is not part of the negotiation the run tracks — someone can ask for Nicolás before Mia has said a word, or after the call's own proposal has already resolved. Gating it on a waiting run would silently drop the command the rest of the time |
| A confirmation, a failure, and an "unclear" notice are all the same new signal type, `"invite"`, distinguished by a `status` field in its data | Three separate signal types | One type the client checks once; a three-way `if` inside is simpler than three subscriptions for what is, from the room's point of view, one kind of event: "something happened with an invite" |
| The invite notice is plain text in the room's existing `--color-room-ink` / `--color-room-ink-muted` | Reusing `bg-alert` / `bg-accent`, as `CallNotice` does outside the call | Both of those tokens are measured against `--color-background`, the light surface. The room's own dark canvas has its own measured family, `--color-room-*`, and neither light-theme token has been measured against it. Two lines of plain text need no new token; a coloured banner inside the room would |
| A one-time, signed, HMAC token — not a database row | A `GuestInvite` table with a `usedAt` column | No Postgres is reachable in this environment to add and run a migration against, and a self-contained token needs none: the signature and the expiry are enough to make it un-forgeable and time-limited without persisting anything. The trade-off is written down below |
| The token is reusable within its 30-minute window, not strictly single-use | Invalidating it on first use | A guest on mobile data is the person most likely to drop the call and need to rejoin. A token that dies on first use would lock them out of their own invitation for a dropped connection, which is a worse failure than the (small) risk of the same link being reused inside a 30-minute window tied to one specific room |
| `GUEST_LINK_SECRET`, a secret of its own | Reusing `VERIFICATION_PEPPER` to sign the token | They protect two different things for two different reasons — a pepper makes a phone number's digest unrecoverable, a link secret makes a token un-forgeable. Reusing one for the other saves an environment variable and costs whoever reads the schema next having to work out that the reuse was deliberate |
| The guest's own screen is a new, smaller component, `GuestRoom`, sharing `useRoom` and `Tile` with `Room` | Reusing `Room.tsx` itself, gating Mia's parts behind `if (guest)` | `Room.tsx` already carries the proposal card, the voice clip, and Mia's figure — none of which make sense for someone who has never signed in and answers no proposal. A shared component with branches for "am I a guest" reads worse than two components sharing the two pieces that are actually the same: the WebRTC hook and a video tile |
| `useRoom`'s room-key fetch is a configurable `keyEndpoint`, defaulting to `/api/room` | A second copy of the hook for guests | The permission handling, the publish/subscribe sequence and all of the Vonage traps recorded in its comments apply identically to a guest. Duplicating that logic is how the two copies quietly drift |
| A duplicate-caption guard is a 60-second, in-memory cooldown keyed by the matched person's id | Deduplicating by the caption line's text, the way `SAID` does for refusals | The same sentence reaches `/api/room/heard` once per browser subscribed to the speaker's stream — normally two, three once a guest is in the room — each call authenticated as a *different* core person. A cooldown on the person being invited is simpler than trying to recognise "this is the same utterance" across requests that share no other field |

---

## Contract

**Detection**, `src/mastra/listening.ts`:

```ts
function isAnInviteCommand(text: string): boolean;

function matchInvitedPerson<T extends { name: string }>(text: string, network: T[]): T | null;
```

**Sending**, `src/lib/sms.ts` — no imports at all, not even `@/lib/log`: `npm run test:unit` runs it directly with plain `node --experimental-strip-types`, which understands neither the `@/` alias nor, transitively through `src/lib/env.ts`, its `DATABASE_URL` requirement. `src/lib/invite.ts` is the one impure caller, reading the real credentials and doing the logging:

```ts
type SmsCredentials = { apiKey: string; apiSecret: string; from: string };

async function sendSmsWith(
  credentials: SmsCredentials,
  to: string,
  text: string,
  fetchImpl?: typeof fetch,
): Promise<string>; // resolves with Vonage's message-id, throws SmsNotAccepted otherwise

class SmsNotAccepted extends Error {}
```

**The guest link**, `src/lib/guest-link.ts`, kept just as free of imports beyond `node:crypto`:

```ts
type GuestLinkCheck =
  | { ok: true; personId: string; sessionId: string }
  | { ok: false; reason: "malformed" | "expired" };

function signGuestLinkToken(personId: string, sessionId: string, secret: string, now?: number): string;
function verifyGuestLinkToken(token: string, secret: string, now?: number): GuestLinkCheck;
```

`src/lib/invite.ts` builds the full URL (`${env.PUBLIC_URL}/join/${token}`) and the guest route calls `verifyGuestLinkToken` directly, each reading `requireGuestLinkSecret()` itself — no shared wrapper, since the only two call sites need one line each and a shared wrapper would have to live in one of the two impure files anyway.

**The invite**, `src/lib/invite.ts`:

```ts
type InvitablePerson = { id: string; name: string; phone: string | null };

async function inviteToCall(sessionId: string, person: InvitablePerson): Promise<void>;
```

**The routes**:

| Route | Answers |
|---|---|
| `GET /api/room/guest/[token]` | `{ applicationId, sessionId, token, name }` for a valid, unexpired token whose person is still `SUPPORT`; 400 malformed, 410 expired, 404 no longer open |
| `POST /api/room/heard` | Unchanged contract. Additionally, in the background: detects an invite command, resolves a name, sends the SMS, and signals `"invite"` once Vonage answers |

**The signal**, sent over the existing `sendSignal(sessionId, type, data)`:

```ts
type InviteSignal =
  | { status: "sent"; name: string }
  | { status: "failed"; name: string }
  | { status: "unclear" };
// sendSignal(sessionId, "invite", JSON.stringify(signal))
```

**Environment**, new:

```bash
# --- Vonage · SMS: inviting the support network into a call -----------------
# Classic API key and secret, over Basic auth — the SMS API has no JWT form.
# From the account's API settings, not from an application.
VONAGE_SMS_API_KEY=""
VONAGE_SMS_API_SECRET=""
# Reuses VONAGE_NUMBER as the sender.

# --- The application's own secrets (addition) --------------------------------
# Signs the one-time link a guest gets by SMS. 32 characters or more, yours to
# choose, and never the same value as VERIFICATION_PEPPER.
GUEST_LINK_SECRET=""
```

`src/lib/env.ts` gains `VONAGE_NUMBER` itself to the schema (present in `.env.example` since spec 0008 but never actually validated or typed), `requireSmsCredentials()`, and `requireGuestLinkSecret()`.

---

## Verification

```bash
npm run typecheck && npm run lint && npm run test:unit && npm run build
```

1. `npm run test:unit` covers: every case `matchInvitedPerson` has to get right (first name only, role-prefixed stored name, accents, zero matches, ambiguous matches); a signed guest-link token round-trips, a tampered signature is rejected, an expired one is rejected; `sendSmsWith` resolves on a faked `status: "0"` response and rejects on a faked non-zero one, with a fake `fetchImpl` and no real network call.
2. With a Postgres reachable and a support-network person seeded by hand with a real `phone` (this environment has neither — see Out of scope), join the call as both core people and say "Mia, invita a Rosa". Within a few seconds both screens read "Invited Rosa to the call.", and the phone behind that number receives the SMS.
3. Open the SMS's link on a third device with no OFFLOAD session. `/join/[token]` shows a plain screen with a "Join the call" button, no sign-in prompt; pressing it puts a third tile into the room as a publisher.
4. Say "invita a" without a name the support network recognises. Both screens read "Didn't catch who to invite." and no SMS goes out — checked by the absence of a `remaining-balance` drop on the Vonage account, since there is no local record to check instead.
5. Wait past the link's expiry (or move the system clock, or lower `GUEST_LINK_TTL_SECONDS` for the test) and open it: a plain sentence saying the link expired, not a stack trace.
6. Read the terminal output through steps 2 and 4: no phone number, no token and no SMS body appear in any log line.

---

## Notes

**What was actually verified against Vonage's own documentation, on 2026-09-20, through the `vonage-docs` MCP**: the SMS API's authentication (Basic auth only, no JWT — the deprecation notice is about query-parameter Basic auth, not about adding JWT support), the endpoint (`POST rest.nexmo.com/sms/json`, form-encoded), the response shape (always HTTP 200; the real result is `messages[0].status`, `"0"` for accepted), the error codes worth handling by name (`15` invalid sender, `9` insufficient balance), and the client SDK's generic `session.on("signal", ...)` event, which carries `event.type` and `event.data` for any signal type — confirming `useRoom`'s signal handling can be generalised without a second, type-specific listener.

**What could not be verified for real**: everything that needs a live call between two browsers and a live Vonage account — an actual SMS arriving on an actual phone, a guest actually joining as a third participant, the 60-second cooldown actually collapsing two browsers' duplicate captions into one send. No Postgres is reachable in this environment either, so `supportNetwork()`, the guest route's person lookup, and the whole path from a spoken sentence to a sent text were read and reasoned through, not run. The `sendSmsWith`/`verifyGuestLinkToken` split above exists specifically so the part that *can* be checked without any of that — the logic — is checked.

**Rule 3, checked against this feature specifically**: the SMS says "Te necesitan en la videollamada" (an active fact — two people asked) and never anything about whether the invited person is free, busy, or reachable. Sending an invite is not a claim about availability; it is a request. The one place this could go wrong — a model inventing that phrasing — does not apply, because the message is a fixed template with only the name and link interpolated, not generated.

**The support network's stored names carry a role prefix in the fixtures this repository already has** (`tests/guardrails.test.ts`: `"Nicolás"`, `"Abuela Rosa"`, `"Vecina Marta"`) but `CLAUDE.md`'s persona table calls them "Nicolás", "grandma Rosa" and "neighbour Marta" in English prose. Whatever ends up in `Person.name` for real, `matchInvitedPerson`'s last-word rule holds for both "Rosa" and "Abuela Rosa".
