# 0005 — One account menu, everywhere being signed in matters

| | |
|---|---|
| **Status** | Implemented |
| **Area** | frontend |
| **Issue** | #NN |
| **Date** | 2026-09-20 |

---

## Problem

The presentation screen — Mia's mascot, the day's calendar preview — replaced the home page
without carrying over the session check the sign-in work had already built. `/` painted the same
screen for everyone, signed in or not: the check that used to decide between "here's your day"
and "sign in first" was gone, and nothing on screen said whether a session existed at all.

The gap showed up everywhere a person would expect to see themselves. The voice flow's three
screens had a back arrow that led nowhere useful (`BottomNav` already covers leaving), a bottom
menu with tabs for screens that don't exist (`Week`, `Plan`), and no way to tell who — if anyone —
was using it. The presentation page's own header had no way to sign out either. Two different
surfaces, the same missing piece.

---

## Acceptance criteria

- [x] `/` shows the sign-in door to anyone without a session, and the presentation screen only to
      someone signed in — never the presentation screen unconditionally
- [x] The presentation header and both states of the voice flow show an account menu (name, phone
      tail, sign out) whenever someone is signed in, and nothing in that corner when nobody is
- [x] The voice flow's logo sits where the back arrow used to; nothing in the flow relies on that
      arrow to be reachable
- [x] `BottomNav` only links to screens that exist or are named for what they'll become — no tab
      promises a "Week" or "Plan" screen that isn't there
- [x] Nothing in the sign-in screen suggests a step that doesn't help right now (the wifi notice
      explained a real constraint but read as a blocker before someone had even seen the phone
      field)
- [x] No dead end: a button that used to lead to a screen that doesn't exist (`/plan`) is gone
      rather than left pointing at a 404

---

## Scope

**The session check on `/`**, restored: a server component reads `currentPerson()` and renders the
sign-in door or the presentation screen, never both, never neither.

**`OffloadHeader`**, a new shared component: the logo on the left, the account menu on the right,
used by both states of the voice flow (`ListeningScreen`, `ReviewPlan`) instead of each screen
building its own header.

**The same account menu on the presentation page's header** (`AppNavigation`), reusing the
pattern rather than a second implementation of it.

**Three small removals**, each one a piece that stopped pointing at anything real once the rest of
this landed: the voice flow's back arrow (`BottomNav` is the way out now), the wifi notice on the
phone sign-in screen, and the "Review the plan" button (`/plan` doesn't exist).

**`BottomNav`'s tabs**, reduced to what's real: `Home` (a house icon, back to `/`), `Offload`, and
`Time` — `Week` and `Plan` are gone rather than kept as links to nothing.

---

## Out of scope

**Redirecting `/offload` itself when nobody is signed in.** The route still renders for anyone;
only the header's account menu is conditional on a session existing. Gating the whole voice flow
behind sign-in is a decision for whoever owns that flow next — this work stops at showing the
right thing in the header, not at deciding who gets to record.

**A light-theme version of `BottomNav`.** It stays coloured for the immersive palette, the only
one it appears on today. The comment already on it says as much: once a screen exists on the
light background that needs this menu, it needs a variant built next to that screen, not guessed
here.

**Explaining the wifi constraint some other way.** Silent Auth still needs mobile data, not wifi,
underneath. Removing the notice removes the explanation, not the constraint — see Notes.

**A `/week`, `/plan` or `/tiempo` screen.** `Home` now points at a screen that exists (`/`);
`Time`'s link stays in place for later, same as before.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| One shared `OffloadHeader` component, used by both states of the voice flow | Repeating the same header markup in `ListeningScreen` and `ReviewPlan`, as the back-arrow version had been | This project's own rule: a second copy of the same thing is how consistency stops holding the first time one of the two gets edited and the other doesn't |
| The account menu's popover is a plain light card (`bg-white`, `text-ink`), not built from the immersive tokens | Measuring a dark version of the same menu for the voice flow's header | It's the exact same content and the exact same `Button` `secondary` variant the presentation page already uses correctly-contrasted; a second, dark-surface version of one dropdown is exactly the kind of second stylesheet this project's conventions warn against |
| The back arrow is gone, not replaced with a smaller one next to the logo | Keeping a back arrow alongside the new header | `BottomNav` already reaches everywhere the arrow could go. A control that duplicates another control's job is a decision to maintain two ways to do one thing, for no benefit either reads on screen |
| `BottomNav`'s first tab becomes `Home` → `/`, reusing the same icon `AppNavigation`'s own mobile nav already uses for the same destination | Leaving the tab as `Week` and building a `/semana` screen | No `/semana` screen exists or was scoped anywhere in this work. Pointing the tab at a real screen beats holding a place for one that isn't planned |
| The wifi notice is removed outright | Rewording it to be shorter, or moving it to appear only after a failed attempt | Explicit direction: the person using this decided the notice reads as friction before the phone field is even in view, and the constraint it describes doesn't disappear by explaining it differently — it's a product call about first impressions, not a wording problem |

---

## Contract

**No new routes or API shapes.** This work is entirely presentational: which component renders
where, and what each one is handed.

```ts
// src/components/OffloadHeader.tsx
function OffloadHeader({ person }: { person: SignedInPerson | null }): JSX.Element

// src/components/ListeningScreen.tsx — `onBack` removed, `person` added
function ListeningScreen(props: {
  status: ListeningStatus;
  transcript: string;
  errorMessage?: string;
  levels: number[];
  person: SignedInPerson | null;
  onStart: () => void;
  onStop: () => void;
}): JSX.Element

// src/components/ReviewPlan.tsx — `onBack` and `onReview` removed, `person` added
function ReviewPlan(props: {
  items: PlanItem[];
  person: SignedInPerson | null;
}): JSX.Element

// src/components/app-navigation.tsx — now takes a person
function AppNavigation({ person }: { person: SignedInPerson | null }): JSX.Element
```

**`src/app/offload/` split in two**, because only a server component can read the session cookie:
`page.tsx` fetches `currentPerson()` and renders `OffloadFlow`, the client component that used to
be the whole page and now takes `person` as a prop instead of computing nothing.

**`src/app/page.tsx`**: `HomePage` is unchanged in shape (a server component branching on
`currentPerson()`), with `Presentation` now taking `person` instead of nothing, to hand to
`AppNavigation`.

---

## Verification

```bash
npm run typecheck
npm run lint
npm run dev
```

1. Open `/` in a browser with no session: expect the sign-in door, not the presentation screen.
2. Sign in (phone or Google): expect the presentation screen, with an account icon top-right in
   `AppNavigation` that opens to show your name, phone tail and a sign-out button.
3. Open `/offload`: expect the same account menu top-right, the logo top-left, no back arrow
   anywhere in the flow, and a bottom menu reading `Home`, `Offload`, `Time` — no `Week`, no `Plan`.
4. Tap `Home` in that bottom menu: land back on `/`.
5. Sign out from the account menu, reload `/offload`: the account menu is gone from the header,
   everything else renders the same.
6. Start the phone sign-in flow: no wifi notice appears before the phone number field.
7. Record a message through to the review screen: no "Review the plan" button appears under the
   list of items.
8. Walk the whole flow with `Tab` and `Enter` alone, focus visible throughout.

---

## Notes

**The wifi constraint is still real.** Silent Auth needs to reach the carrier over mobile data;
with wifi on, the browser cannot confirm the line silently and the person is left waiting on a
step that cannot finish. Removing the on-screen notice removes the explanation, not the failure
mode — flagged to the person who asked for its removal, and this is where that trade-off is
written down rather than left implicit.

**Gating `/offload` itself behind a session is the natural next step, and it wasn't done here.**
Right now someone without a session can still reach the voice flow directly; they'd simply see no
account menu in its header. Whether that's acceptable for the demo or needs its own redirect is a
decision for whoever picks this up next.

**This spec, like 0002's, was written after the code.** The work landed as a sequence of small,
specific requests during a live session rather than as one planned feature, which is why the
acceptance criteria above read as a punch list more than a single problem statement.
