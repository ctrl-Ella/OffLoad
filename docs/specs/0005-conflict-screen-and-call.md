# 0005 — The clash screen and the video call

| | |
|---|---|
| **Status** | Draft |
| **Area** | frontend · backend · video |
| **Issue** | #25 |
| **Date** | 2026-09-20 |

---

## Problem

Mia's whole job is finding what does not fit in a day and, when a yes or a no will not settle it, getting the two people who can settle it in front of each other. Today the product can read a calendar and it can draw Mia, and it does neither of those two things: there is no arithmetic that says two stops clash, no screen that shows one, and no room to talk it through in.

The internal prototype has all three, and they are built on the rule that decides almost everything: a clash changes someone's plans, so Mia shows it and asks, and the call is the exception she never opens on her own. Bringing them over is not a copy. The prototype's identifiers, tokens and copy are Spanish, its design system is a different one, and half of what its room does — Mia's proposal, her voice, the yes-or-no card — leans on a workflow that does not exist here yet.

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
- [ ] Live captions in Spanish appear under the tiles as people speak, and Mia's tile reads "Escuchando" only once the first caption has arrived
- [ ] Whoever did not open the call sees on `/` that the other person did, with a link in, and the notice goes away by itself when the room empties
- [ ] Every colour on the room is a token in `tokens.css` with its measured contrast beside it
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:unit` and `npm run build` pass

---

## Scope

**The arithmetic**, `src/lib/conflicts.ts`, pure: the haversine distance, the trip estimate at a declared city speed, and the two shapes of clash. **The places**, `src/data/places.ts`, the named places of the demo week with neighbourhood-level Barcelona coordinates. **The day**, `src/lib/schedule.ts`, which wires Google Calendar, the unconfirmed captures, the places and the arithmetic into one lane per person; and `src/lib/calendar.ts`, which reads a day's events. **The clock**, `src/lib/clock.ts`: the household's timezone and the two instants a Madrid day runs between.

**The clash screen**, `/conflict`, and the `ConflictBreakdown` it composes. **The home screen** gains the day's status and the call notice.

**The room**: `src/lib/video.ts` for Vonage (session, tokens, captions, who is inside), `src/lib/room.ts` for the one stored room, the two routes under `/api/room`, the `useRoom` hook, the `Room` component and the `/call` screen. **The `room-*` tokens** and two `Button` variants, `danger` and `room`.

**The environment**: the four video variables read by `requireVideoCredentials()`. They were already in `.env.example`; the schema now reads them.

---

## Out of scope

**Mia's proposal inside the call, her voice, and the yes-or-no card.** In the prototype the room polls for the open proposal, fetches its clip, and shows the two buttons when the clip ends. All of that reads a suspended run. There is no workflow here yet, and a room that showed a card with nothing behind it would announce something that is not true. Mia's tile stays: it listens, and it says so once the captions prove it.

**Sending what is heard to Mia.** The captions are shown; nothing is posted anywhere. The hand-off to the interpreter is the workflow's first step and arrives with it.

**The signal that wakes the room** when a proposal lands. Same reason: there is nothing to signal.

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
| The interface text of these screens is English | Spanish, as the root rules say the family's screens are | The port was asked for in English, and the voice flow already carries the same exception. Mia's own labels stay Spanish, since they are her contract from spec 0003. This is the one open question below |

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
| `GET /api/room` | `{ applicationId, sessionId, token }` for the core; 401, 403, 502 or 503 with a reason |
| `GET /api/room/status` | `{ inCall: boolean, who: string \| null }`; `inCall: false` to the support network |

**Environment**, already in `.env.example`:

```bash
VONAGE_APPLICATION_ID=                          # the video application, not Verify's
VONAGE_PRIVATE_KEY_PATH=./private.key           # local
VONAGE_PRIVATE_KEY=                             # Railway: escaped newlines or base64. Wins over the path
VONAGE_VIDEO_BASE=https://video.api.vonage.com  # never api.opentok.com
```

**Command**: `npm run test:unit`.

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

---

## Notes

**The prototype's room is the source of truth for the Vonage sequence**: `initPublisher.promise` rather than the callback form, subscribing to one's own stream at zero volume to receive one's own captions, and the moderator token the captions endpoint demands. All three were checked against the Vonage documentation MCP on 2026-09-20 and match: `POST /session/create` with `p2p.preference=disabled`, `POST /v2/project/{id}/captions` with a moderator token and `es-ES`, `GET /v2/project/{id}/session/{id}/stream` answering `count`, and the client JWT with `sub: "video"`, `scope: "session.connect"` and the `/session/**` ACL.

**With the demo week as written nothing clashes.** Elvia's Thursday has work until 17:00 and the dentist at 17:45 with no place on the first, so no trip is estimated and nothing is claimed. The collision is added by whoever rehearses, as spec 0004 decided; step 1 above is that.

**The places table is the QA lane's to own.** Its coordinates are neighbourhood level and say so. "Mercadona" is left out on purpose: there are dozens, and picking one would be guessing.

**Open question: the language of these screens.** The root rules say the family's screens are Spanish, and the home screen, the door and Mia's labels are. The voice flow is English by a confirmed decision, and this port was asked for in English. Both now sit on the same home screen. Whichever way it is settled, it is one pass over four files and it should be settled before the demo.

**Open question: the label under Mia in the room** reads "Callada" and "Escuchando" on an English screen, because `MIA_LABELS` is her contract from spec 0003 and this spec does not touch it.

**The issue number is provisional.** The branch and this spec carry #25; if the issue lands with another number, both are renamed before the pull request.
