# 0005 — The clash screen and the video call

| | |
|---|---|
| **Status** | Draft |
| **Area** | frontend · backend · video |
| **Issue** | #33 |
| **Date** | 2026-09-20 |

---

## Problem

Mia's whole job is finding what does not fit in a day and, when a yes or a no will not settle it, getting the two people who can settle it in front of each other. Today the product can read a calendar and it can draw Mia, and it does neither of those two things: there is no arithmetic that says two stops clash, no screen that shows one, and no room to talk it through in.

The internal prototype has all three, and they are built on the rule that decides almost everything: a clash changes someone's plans, so Mia shows it and asks, and the call is the exception she never opens on her own. Bringing them over is not a copy. The prototype's identifiers, tokens and copy are Spanish, its design system is a different one, and half of what its room does — Mia's proposal, her voice, the yes-or-no card — leans on the `resolveConflict` workflow, which arrives with this spec because the room does not stand without it.

---

## Acceptance criteria

### The arithmetic

- [ ] Two stops of the same person that overlap are a clash, with a negative gap
- [ ] Two stops back to back in time but far apart on the map are a clash, with the trip declared as a straight-line estimate
- [ ] Two stops with no known place claim nothing, however short the gap
- [ ] Two people in two places at the same time are not a clash
- [ ] `npm run test:unit` covers the four lines above and passes without a database, a network or a clock

### The screen

- [ ] `/` tells the core circle one of four things: no Google connected, Google did not answer, nothing clashes, or the first clash with a link to `/conflict`. The first two never read as a free day
- [ ] `/conflict` shows the first clash full screen: what you leave and when, why it does not fit with the origin of each figure, what you do not reach and when, and how many more clashes there are
- [ ] `/conflict` offers two ways out and only two: the call, as a link, and asking the support network, with the words that Mia cannot see their calendars
- [ ] `/conflict` answers 404 when nothing clashes, and `/call` answers 404 to the support network
- [ ] Both screens end with Mia quiet and the sentence that nothing in the day was changed

### The call

- [ ] Two core people in two browsers press "Join the room" and see each other in the same room, with their names under the tiles
- [ ] A denied camera permission, a missing camera, a camera held by another window, an unsupported browser and a plain-http address each produce a different sentence saying what to do
- [ ] Microphone, camera and the call's sound can each be switched off on their own, and hanging up releases the camera
- [ ] Live captions in Spanish appear under the tiles as people speak, and Mia's tile reads "Listening" only once the first caption has arrived
- [ ] Whoever did not open the call sees on `/` that the other person did, with a link in, and the notice goes away by itself when the room empties

### Mia inside the call

- [ ] Handing over the room's key starts one run that reads both calendars and stops at the clash, waiting for the call. A second person joining starts no second run
- [ ] Mia stays quiet while one person has said they cannot; once both have, her tile reads "Asking for the floor" and a button to give her the floor appears
- [ ] Pressing it plays her clip; her tile reads "Speaking" only while it plays, and the two buttons appear only when it ends. Without a clip the buttons appear anyway
- [ ] The proposal names someone in the core only if their calendar was read and is free in the slot; of the support network she says they exist and asks whether to call, never that they are free. `npm run test:guardrails` holds that with code
- [ ] Either core person answers; the run resumes at the step it stopped and the card leaves both screens. A "no" from the partner brings the question about the network to whoever started
- [ ] No log line carries a caption, a proposal's text or a name from the support network
- [ ] Missing `NEBIUS_API_KEY`, `NEBIUS_MODEL_SMALL` or `NEBIUS_MODEL_LARGE` fails naming the variable, when the agent is called and not at start-up
- [ ] Every colour on the room is a token in `tokens.css` with its measured contrast beside it
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:unit` and `npm run build` pass

---

## Scope

**The arithmetic**, `src/lib/conflicts.ts`, pure: the haversine distance, the trip estimate at a declared city speed, and the two shapes of clash. **The places**, `src/data/places.ts`, the named places of the demo week with neighbourhood-level Barcelona coordinates. **The day**, `src/lib/schedule.ts`, which wires Google Calendar, the unconfirmed captures, the places and the arithmetic into one lane per person; and `src/lib/calendar.ts`, which reads a day's events. **The clock**, `src/lib/clock.ts`: the household's timezone and the two instants a Madrid day runs between.

**The clash screen**, `/conflict`, and the `ConflictBreakdown` it composes. **The home screen** gains the day's status and the call notice.

**The room**: `src/lib/video.ts` for Vonage (session, tokens, captions, who is inside), `src/lib/room.ts` for the one stored room, the two routes under `/api/room`, the `useRoom` hook, the `Room` component and the `/call` screen. **The `room-*` tokens** and two `Button` variants, `danger` and `room`.

**The workflow**, `src/mastra/`: the one Mastra instance with its store in the `mastra` schema; the two agents, `interpreter` on the small tier and `negotiator` on the large one, with rule 3 in `agents/support-network.ts` as code that imports only Zod; and `resolveConflict`, seven steps in `workflows/resolve-conflict.ts` — interpret, read the calendars, detect the clash, listen to the call, propose, ask the partner, ask whether to call — with the case file, the card and the date border in their own modules. `workflows/proposals.ts` reads the open question out of the suspended runs, `workflows/listening.ts` starts a run when the room's key is handed over and wakes it when both have said no, and `mastra/listening.ts` is the deterministic rule for that moment.

**Mia in the room**: `/api/room/heard` receives every final caption and decides whether she speaks, `/api/room/proposal` is what is on the table, `/api/room/voice` is her clip, `/api/proposals/[runId]/answer` resumes the run, and the Vonage signal that tells both screens to look again. The room polls, downloads the clip as soon as she raises her hand, plays it only when someone gives her the floor, and shows the two buttons when it ends.

**The environment**: the four video variables and the four Nebius ones, read by `requireVideoCredentials()`, `requireModelKey()` and `requireModel()`.

**The places table** gains the household's own eight places, the ones the interpreter's prompt names.

---

## Out of scope

**Starting a run from dictation.** The prototype's `/api/conflicto` takes the transcript of a brain dump and starts the workflow with it; here the voice flow has its own extraction route and does not start a run. The workflow's first step keeps the interpreter and the capture saving, so wiring the two is one route. Until then a run only starts when the room's key is handed over, with empty text.

**Showing pending proposals outside the call.** `openProposalsFor()` exists for it; the screen that lists them belongs to the day's journey, which is not built.

**The SIP leg for Nicolás.** The room is created `routed` so it can take one; the leg itself is the call lane's next piece.

**Door-level coordinates.** The places table is neighbourhood level and the trip is a straight-line estimate declared as such. A routing service would refine a figure the product already says is approximate.

**Turning the demo week into a week with clashes.** Spec 0004 leaves the collision to whoever rehearses. With the week as written nothing clashes, `/conflict` answers 404, and `/` says so in those words.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| The clash is two shapes, `overlap` and `no-time`, and `no-time` carries a trip that is never null | One shape with a nullable trip | On a `no-time` the trip is what was claimed, so the screen should not have to handle its absence. The prototype's screen carried a branch for a trip that could not exist |
| The day comes from Google plus the unconfirmed captures | Google alone | What someone just told Mia counts for the arithmetic even though it is on no calendar yet. Without it, what you just said would never clash with anything |
| A Madrid day is computed through the zone | A written `+02:00` | Madrid is `+01:00` half the year. A fixed offset moves every winter day by an hour |
| Reading a day moves to `src/lib/calendar.ts`; the demo script keeps its own writes | Everything in the script, as spec 0004 decided | That spec kept the calls in the script because they had one caller. The clash screen is the second, and reading a day is the one call they share |
| No travel time without a known place, and no fuzzy matching of places | Nearest match, or a default speed for unknown places | A short gap between two unknown places may be fine or not. Calling it a clash would be inventing a fact, which is rule 4 |
| Mia is `listening` only after the first caption, and `quiet` before | `listening` from the moment the room is joined | Captions can fail to start and the call goes on without them. Claiming to hear with nothing heard is rule 4 broken in the one place it shows |
| The call is a link on `/conflict`, never opened by Mia | Mia opening the room when the clash needs another person | Opening a call interrupts several people at once. It is what changes everyone's plans the most, and that decision belongs to whoever reads the clash |
| Who is inside the room is asked of Vonage, not stored | A flag set on join | Whoever closes the tab without hanging up never clears the flag. The active streams are the truth |
| One room for the household, stored in Postgres | A session per call | Two calls to create a session are two rooms, and Elvia and Carlos would each see only themselves. Stored on disk because Railway restarts the process |
| The room is `routed` from creation | Peer-to-peer | Live captions and the SIP leg read the audio from the Media Router. It cannot be changed on a session that exists |
| The private key for video never touches disk | Materialising it like the verification key | `tokenGenerate` signs with the content, so the file the verify SDK needs is the only reason a key is ever written |
| Its own dark tokens, `room-*`, not the immersive ones | Reusing `surface-immersive` | The immersive surface is the brand's onyx worn as a background. A room wants a neutral stage that stays out of the way of skin tones, and it is dark for a different reason |
| Two `Button` variants, `danger` and `room` | Overriding classes at the call site | A hover to white on the dark canvas swallows the light ink. A variant measured once beats a class fought over at every use |
| Every screen is English, Mia's state labels and the card's buttons included; only what she says out loud is Spanish | Spanish screens, as the root rules said until now | Team decision on 2026-09-20, which closed the question the earlier rule left open and is now written in `CLAUDE.md`. The door, the sign-in, the home and `/system` move with this spec so no screen is left behind |
| Mia speaks only once both have said they cannot, decided by a list of refusals and not by a model | Waking her when the clash is named, or asking a third model whether to speak | Waking her on the clash's name put her in the middle of the negotiation repeating what had just been said. When to speak is a decision, and the thesis is that the workflow decides. The list misses a no said without saying no, and that is written down |
| The run reads the day through `coreJourney`, captures included | Reading Google again inside the workflow, as the prototype did | One read path for the screen and for the run means the clash on `/conflict` is the clash Mia talks about. The capture that opened the run is already in the lanes, so the workflow no longer carries it separately |
| The interpreter's seven labels are the English ones `Capture.kind` documents | The prototype's Spanish labels, which the benchmark measured | The schema comment is this repository's contract, and the benchmark already had a pending re-run because the output shape changed. Both are one more reason to run it again, and that goes in the notes |
| The negotiator's decisions are `propose`, `call`, `no-way-out` and the empty person is `nobody` | The prototype's Spanish values | Values a program branches on are identifiers, and identifiers are English by the root rules. What the model reads about them stays Spanish, in the descriptions |
| The prompts and the card's spoken question are Spanish; the button labels are English | Everything in one language | The prompts are what the models are measured on, and the question is what Mia says out loud. Her voice is Spanish by the root rules. The buttons are screen |
| The model is an AI SDK provider instance, and the identifier has no `nebius/` prefix | Mastra's own router with `nebius/…` strings | The router does not list Nebius. The prefix is the router's convention; on a provider instance it would be part of the model id and fail. `supportsStructuredOutputs` on that instance is what turns constrained decoding on |
| The transcript of a call lives in memory on the server | Storing the lines | A call lasts three minutes and a restart cuts it anyway. What survives is the decision, which goes to the run. Nothing of the text is logged |
| Every field of an intent but `kind` may be missing in what the model returns, and code fills the gap | Demanding every field, as `Capture.kind`'s contract does | Measured: the small model leaves `title`, `place` and `when` out on questions, and a strict schema turns that into a failed run with the whole dump lost. What leaves `interpretDump` is still strict; the tolerance is at the model's door only |
| Both agents generate at temperature zero | The provider's default | It is what the benchmark measured with, and the difference is not small: the negotiator went from 4 of 6 in 14 seconds to 6 of 6 in 3. A decision about who is free should not change on the second ask |
| The agents are measured through the product's own functions, with `npm run bench:agents` | Only the standalone benchmark with its own prompt copy | A prompt copy drifts from the one that ships and the figure stops describing the product. The script imports `interpretDump` and `proposeAndCorrect` and runs the same cases; the standalone one keeps what this cannot see, tokens, cost and time to first token |

---

## Contract

**The arithmetic**, `src/lib/conflicts.ts`:

```ts
type Stop = { id; personId; title; startsAt: Date; endsAt: Date; place: Coordinates | null };
type Conflict =
  | { reason: "overlap"; previous: Stop; next: Stop; gapMin: number; travelMin: number | null }
  | { reason: "no-time"; previous: Stop; next: Stop; gapMin: number; travelMin: number };

function detectConflicts(stops: Stop[]): Conflict[];
```

**The day**, `src/lib/schedule.ts`:

```ts
type Lane = { personId; name; stops; conflicts; pending: Set<string>; status: "no-google" | "unavailable" | "ready" };

function coreJourney(day?: string, onlyFor?: string): Promise<Lane[]>;
```

**The routes**:

| Route | Answers |
|---|---|
| `GET /api/room` | `{ applicationId, sessionId, token }` for the core; 401, 403, 502 or 503 with a reason. Starts a run if none waits |
| `GET /api/room/status` | `{ inCall: boolean, who: string \| null }`; `inCall: false` to the support network |
| `POST /api/room/heard` | `{ text, who, force? }` → `{ speaks: boolean, why, because? }` |
| `GET /api/room/proposal` | `{ proposal: { runId, question, detail, yesLabel, noLabel, recipientName, forYou } \| null }` |
| `GET /api/room/voice` | `audio/wav` of the open proposal; 404 with nothing to say; 502 when SLNG fails |
| `POST /api/proposals/[runId]/answer` | `{ accepts: boolean }` → 202; 409 when the question is no longer open; 403 outside the core |

**The card**, `cardSchema`, frozen once the first full rehearsal runs: it is serialised inside the run's snapshot.

```ts
{ recipientId; recipientName; question; detail; yesLabel; noLabel }
```

**Environment**, already in `.env.example`:

```bash
VONAGE_APPLICATION_ID=                          # the video application, not Verify's
VONAGE_PRIVATE_KEY_PATH=./private.key           # local
VONAGE_PRIVATE_KEY=                             # Railway: escaped newlines or base64. Wins over the path
VONAGE_VIDEO_BASE=https://video.api.vonage.com  # never api.opentok.com
NEBIUS_API_KEY=
NEBIUS_MODEL_SMALL=                             # the interpreter. No default in code
NEBIUS_MODEL_LARGE=                             # the negotiator. No default in code
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1
```

**Commands**: `npm run test:unit`, `npm run test:guardrails`, `npm run bench:agents` (spends tokens; `--suite intent` or `--suite grounding` for one).

---

## Verification

```bash
npm run typecheck && npm run lint && npm run test:unit && npm run build
npm run dev
```

1. Sign in as Elvia with Google connected. `/` says nothing clashes. Add an event in Google Calendar on top of one from the demo week and reload: `/` names the one you will not make it to, with a link.
2. Open `/conflict`. The two stops, the times in Madrid, and the line between them saying by how many minutes they overlap. Remove the added event: `/conflict` answers 404.
3. Add two events with places from `src/data/places.ts` five minutes apart, for example "Clínica Bonanova" and "Poble Sec". The line reads the gap, the trip, and the words "estimated in a straight line".
4. Sign in as Carlos in a second browser. On `/conflict` each screen names the other person. Press "Open the call" on both and "Join the room" on both: two tiles, two names, and "Hasn't joined yet" gone.
5. Speak. The caption line moves, and Mia's tile changes from "Callada" to "Escuchando" only after the first line arrives.
6. On one browser, hang up. On the other, "Hasn't joined yet" returns. Back on `/`, the first browser shows "Carlos has opened a call." with a link, and it disappears when the second hangs up too.
7. Deny the camera permission and press "Join the room": the sentence names the padlock in the address bar. Open a second tab on the same browser and join: the sentence says something else is using the camera.
8. Open the app over the network address of the machine, `http://192.168…`, and press "Join the room": the sentence says https or localhost is needed, before anything is downloaded.
9. Tab through `/conflict` and `/call`: every control shows the focus ring, the icon-only buttons announce their action and whether they are pressed, and hanging up is reachable in phone landscape without scrolling past it.
10. Sign in as someone from the support network: `/call` answers 404 and `/api/room/status` answers `inCall: false`.
11. With a clash on Elvia's day, both join the room. The log shows one run reading the calendars and stopping at "waiting for the call", and only one even though two people joined. Mia reads "Listening" and no button appears.
12. Carlos says "es que yo a esa hora no puedo". Nothing changes. Elvia says "yo tampoco". Within a few seconds Mia reads "Asking for the floor" on both screens and the button to give her the floor appears.
13. Press it. She speaks in Silvia's voice, in Spanish, her tile reads "Speaking" while the clip plays, and when it ends the two buttons appear, "I'll go" and "I can't". Turn the call's sound off before pressing: she is still heard.
14. Press the declining button on either screen. The card leaves both screens; if the network exists in `people`, the next card asks whoever started whether to call, naming them and never saying they are free.
15. Read the terminal output of steps 11 to 14: no caption, no proposal text and no support-network name appears in any line.
16. Empty `NEBIUS_MODEL_LARGE` and repeat step 12: the run fails at the proposing step with a message naming the variable, the call goes on, and the room shows no card.

---

## Notes

**The prototype's room is the source of truth for the Vonage sequence**: `initPublisher.promise` rather than the callback form, subscribing to one's own stream at zero volume to receive one's own captions, and the moderator token the captions endpoint demands. All three were checked against the Vonage documentation MCP on 2026-09-20 and match: `POST /session/create` with `p2p.preference=disabled`, `POST /v2/project/{id}/captions` with a moderator token and `es-ES`, `GET /v2/project/{id}/session/{id}/stream` answering `count`, and the client JWT with `sub: "video"`, `scope: "session.connect"` and the `/session/**` ACL.

**With the demo week as written nothing clashes.** Elvia's Thursday has work until 17:00 and the dentist at 17:45 with no place on the first, so no trip is estimated and nothing is claimed. The collision is added by whoever rehearses, as spec 0004 decided; step 1 above is that.

**The places table is the QA lane's to own.** Its coordinates are neighbourhood level and say so. "Mercadona" is left out on purpose: there are dozens, and picking one would be guessing.

**The language of the screens is settled**: English everywhere, by team decision on 2026-09-20, and written into `CLAUDE.md`. The door, the sign-in, the home screen, `/system` and `MIA_LABELS` moved with this spec. Spec 0003's line that her labels are Spanish is superseded here.

**The support network has to exist in `people` with `circle = SUPPORT`.** The negotiator reads it from there, and the seed writes only the core. Without Nicolás, Rosa and Marta in the table, Mia never asks whether to call anyone: whoever rehearses adds them first, or the seed gains them.

**The agents were measured again on 2026-09-20, through the product itself.** `npm run bench:agents` runs the thirty dictated sentences through `interpretDump` and the six grounding situations through `proposeAndCorrect`, with the models the application reads from the environment. It is not the standalone benchmark: that one carries its own prompt and a narrower schema, and its figure describes the classifier, not the product. This one describes what ships.

| suite | model | accuracy | n | invented availability | p50 | p95 |
|---|---|---|---|---|---|---|
| intent | Qwen3-30B-A3B-Instruct-2507 | 93.3 % | 30 | — | 794 ms | 1811 ms |
| grounding | DeepSeek-V4-Pro | 100 % | 6 | 0 of 6 | 2968 ms | 3103 ms |

The two intent misses are judgement calls the earlier benchmark also lost: "A ver si puede ir mi madre a por el niño" read as a question instead of a delegation, and "la profe dijo que hay reunión pronto, sin fecha" read as a reminder instead of a note. Both are one label away and neither puts a time on anyone's calendar.

Two things the first run of the day found, and both changed the code rather than the report. The interpreter's schema demanded `title`, `place` and `when` on every intent, and on questions — "¿qué me queda por hacer hoy?" — the small model left them out, which turned three sentences into failed runs with the whole dump lost: the model now gets a schema where every field but `kind` may be missing, and `interpretDump` fills the gaps with the sentinel or the sentence itself. And neither agent set a temperature, so both ran at the provider's default: the negotiator scored 4 of 6 and took 14 seconds per case, and with temperature zero — what the benchmark had always measured with — it scored 6 of 6 in 3 seconds. The first run is kept in `bench/results/` next to the last so the difference can be checked.
