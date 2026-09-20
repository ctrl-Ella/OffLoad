# 0010 — Choosing whom to call, from the card

| | |
|---|---|
| **Status** | Implemented |
| **Area** | frontend · backend · video |
| **Issue** | #45 |
| **Date** | 2026-09-20 |

---

## Problem

Inside the call, Mia hears both core people rule the plan out, asks for the floor, and asks «Del núcleo no puede nadie. En tu red tienes a Nicolás, Abuela Rosa y Vecina Marta. ¿Llamo a alguno?». Two buttons appear: **Call** and **I'll sort it out**.

Pressing **Call** resumes the run at `askWhetherToCall`, which is the workflow's last step. The run finishes, the card disappears, and nobody is called. The yes was recorded and led nowhere, which is rule 4 broken from the other side: Mia offered something and the product did not deliver it.

The piece that actually reaches the support network exists since spec 0009 — a spoken «invita a Marta» sends an SMS with a link into the call — but it is a separate door with no path from the card to it. Someone who just said yes to «¿Llamo a alguno?» has to know the magic phrase.

One more gap on the same thread: `prisma/seed.ts` never writes `Person.phone`, so `inviteToCall` finds no number on file for anyone in the support network and every invitation, spoken or otherwise, ends in «Couldn't reach».

---

## Acceptance criteria

- [ ] After pressing **Call** on the «¿Llamo a alguno?» card, the screen that pressed it shows one button per person in the support network, and a line saying Mia does not know whether any of them is free
- [ ] Pressing a name results in the same SMS spec 0009 sends for «invita a Marta», and both core screens show «Invited Vecina Marta to the call.» only after Vonage accepted it
- [ ] Pressing the same name twice within a minute sends one text, whichever door it came through
- [ ] **Not now** closes the list and sends nothing
- [ ] Pressing **I'll go** or **I can't** on the other card (`askPartner`) opens no list
- [ ] The list carries names and identifiers only; no phone number reaches the browser
- [ ] The support network cannot open the list or call `/api/room/invite`: a `SUPPORT` session gets a 403
- [ ] After `npm run db:seed`, the three support-network rows carry a `phone` and the two core rows do not
- [ ] When a guest joins through their link, the core screens show their video beside the other core person's, not hidden under it
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:unit` and `npm run build` pass
- [ ] Nothing under `src/mastra/agents/` or `src/mastra/workflows/` is touched

---

## Scope

**Knowing which card it is.** `GET /api/room/proposal` gains `asksToCall`, computed on the server from the suspended step's id. The screen reads a boolean; the step's name stays beside the workflow.

**The second door into `inviteToCall`.** `src/app/api/room/invite/route.ts`: `GET` lists the support network as `{ id, name }`, `POST { personId }` sends the invitation in the background and answers 202. Both require a signed-in core session, as every other room route does.

**The list on screen.** `Room.tsx` gains a `choosing` state, set by a yes to a card whose `asksToCall` is true, and a `WhomToCall` piece: one `Button` per person, **Not now**, and one sentence. The confirmation reuses the `"invite"` signal and the `InviteLine` already there.

**One cooldown, not two.** The minute-long guard that spec 0009 kept in `/api/room/heard` moves into `inviteToCall`, so a pressed name and a spoken one are collapsed by the same map.

**The seed writes the number.** `prisma/seed.ts` sets `phone` for `SUPPORT` rows and `null` for `CORE`, on create and on update, so re-seeding a database that already has the rows fills them in. Decision 0003's consequences paragraph now names the seed as where the number is written today.

**Room for a third stream.** The slot that receives every stream that is not mine becomes a grid with one column per stream. `Room.tsx` still labels that tile with the other core person's name.

---

## Out of scope

**A third suspension in the workflow asking whom.** The run already asked the one question that changes plans — whether to interrupt someone outside the house — and got a yes. Which name is a choice with no calendar behind it, so a model would add nothing and a workflow step would add a third `cardSchema` shape to a snapshot the template warns is hard to change.

**Mia saying the chosen name out loud.** She has already asked «¿Llamo a alguno?»; the SMS is in her voice; the confirmation is screen text, as spec 0009 decided. A new spoken line would need a new clip and says nothing the confirmation does not.

**The other screen seeing the list.** Whoever pressed **Call** chooses. The other person finds out the same way they would for a spoken name: the «Invited … to the call.» line, on both screens.

**Labelling the guest's tile with their name.** The tile that holds everyone who is not me still reads the other core person's name. Giving each stream its own label needs `useRoom` to expose streams individually, which is the layout problem spec 0009 already left for its own change.

**Anyone leaving while two are in that tile.** `streamDestroyed` already empties the subscriber list on any departure; that is spec 0005's behaviour and stays.

**A household-management screen for the support network's numbers.** The seed is where the household is written today, and that is what decision 0003 says.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| The list appears after the yes, on the screen that pressed it | A card with three yes-buttons instead of one | `cardSchema` is serialised inside the run's snapshot; adding a list of choices to it changes a shape the schema's own comment says is hard to change, for a screen-only decision |
| `asksToCall` is computed on the server from the step id | The screen checking `yesLabel === "Call"` | A button's wording is copy, and copy changes; the step's id is what the run resumes by. The route already translates snapshot into screen and this is one more field of that translation |
| The cooldown lives in `inviteToCall` | A second map in the new route | Two doors into one send; the guard against sending twice is knowledge of the send, not of either door |
| `GET /api/room/invite` lists names only | Returning the number so the screen could show it | The screen has no use for it and every field that leaves the server is one more place a number can be read from |
| The seed writes `phone` for `SUPPORT` and `null` for `CORE` | Leaving it to be written by hand in Postgres | Decision 0003 says the number is written when the household adds the person; the seed is that act today, and a step done by hand is the step that gets forgotten on the next database |
| A grid for the other streams' slot | Fixing the whole room's layout for N participants | Two streams side by side is what the demo shows and the change is one class; the general layout is the separate problem spec 0009 named |

---

## Contract

**`GET /api/room/proposal`**, one field added to `proposal`:

```ts
asksToCall: boolean; // true when the open question is «¿Llamo a alguno?»
```

**`GET /api/room/invite`** → `{ network: { id: string; name: string }[] }`. 401 not signed in, 403 outside the core.

**`POST /api/room/invite`** with `{ personId: string }` → `202 { status: "inviting" }`. 400 malformed body, 401, 403, 404 when the id is not in the support network, 409 when there is no room open, 500 when the database did not answer. The outcome travels as the `"invite"` signal of spec 0009, unchanged.

---

## Verification

```bash
npm run typecheck && npm run lint && npm run test:unit && npm run build
npm run db:seed
```

1. With `GUEST_LINK_SECRET`, `VONAGE_SMS_API_KEY`, `VONAGE_SMS_API_SECRET` and `VONAGE_NUMBER` set, and the migration `20260920060000_add_person_phone` applied, run the seed. The output lists five people; a `SELECT name, phone IS NOT NULL FROM people` shows three true and two false.
2. Seed a clash for today with `npm run demo:seed`, open `/conflict` as Elvia and press **Open the call**. Join as Carlos from a second browser.
3. Say «no puedo» from one and «yo tampoco» from the other. Mia asks for the floor; give it to her. If she proposes the partner first, press **I can't**. The card reads «¿Llamo a alguno?» with **Call** and **I'll sort it out**.
4. Press **Call**. The three names appear under Mia, with the line about not knowing whether they are free. The other browser shows nothing new.
5. Press **Vecina Marta**. Within a few seconds both browsers read «Invited Vecina Marta to the call.», and the phone behind `TEST_PHONE_MARTA` receives the SMS.
6. Open the link on that phone. **Join the call** puts a third video beside Carlos's on both core screens.
7. Press **Vecina Marta** again from a fresh **Call** within the minute: no second SMS.
8. Sign in as someone in the support network and request `/api/room/invite`: 403.

---

## Notes

Nothing here touches Mastra or Vonage APIs beyond what spec 0005 and spec 0009 already call, so no documentation check was needed for this change.

What was run: the four commands above, against a local Postgres. What was not: an actual SMS and an actual third participant, which need the production variables this environment does not hold. The first part of this thread that could not be exercised is the same one spec 0009 could not — the path from a pressed name to a phone.
