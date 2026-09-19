# src/components

This folder governs itself: before writing a new component, check here and check the design
system's living page at `http://localhost:3000/sistema` (the colours, measured; the three
typefaces; every state of every component, side by side). It doesn't exist yet — it gets built by
whoever needs to show those states together for the first screen that requires it.

## What lives here

Interface pieces reused across the three screens of the `interface` lane (the day's journey, the
proposal card, the recovered time), plus the trace strip and the voice entry. A full screen lives
in `src/app/<route>/page.tsx` and composes the components here — never the other way round.

The voice entry (`ListeningScreen` and what it composes) is the one deliberate exception to the
light palette below: full screen, full attention, no chrome from the rest of the app around it. It
draws on its own `*-immersive` tokens in `tokens.css` instead of the ones every other screen uses,
and its own visible text stays English rather than Spanish — both confirmed decisions, not gaps to
close by making it match the rest of the folder.

## The lane's rules, applied to this folder

- **No invented data.** A component receives what it's passed as props. If the real value can be
  missing, the component knows how to paint that gap — empty, or in its loading state — without
  simulating a value as if it were real. The page composing the component is the only one that
  decides whether it uses real data or a placeholder for development, and if it does, it says so
  in a comment.
- **Not a loose hex value.** Every colour comes from a token in `src/app/styles/tokens.css`
  (`src/app/globals.css` is just the import chain that pulls it in — it defines nothing itself).
  If a colour is missing, the token gets added there, with its measured contrast next to it —
  never inline in the component.
- **Client only when it needs to be.** `"use client"` only when the component uses state, effects,
  or a Motion or navigation hook. Anything purely visual and static doesn't need it.
- **Focus always visible.** The global focus style from `base.css` stays as it is almost
  everywhere. Its one sanctioned override lives in that same file, scoped to
  `[data-theme="immersive"]`, because the ring's default colour measures 2.73:1 on the voice
  screen's dark surface — a second override anywhere else needs the same kind of measured reason,
  not just a colour that looked better. An icon-only button carries a `label` describing the
  action (`Button` from `ui/button.tsx` turns this into a compile error if it's missing), and that
  label changes if the button's state does.
- **Animation through `useReducedMotionSafe`, never Motion's own `useReducedMotion`.** Any
  JavaScript animation (Motion) asks before it moves, and it asks through the hook in
  `src/lib/motion.ts`: Motion's own hook reads `matchMedia` synchronously on the client's first
  render and, on a machine with reduced motion on, breaks hydration. An entrance uses
  `useAparicion`; a continuous loop (a pulse, a wait) asks `useReducedMotionSafe` separately and,
  when less motion is requested, keeps showing its state without moving — through opacity, or
  staying still, never invisible.
- **Tested in mobile landscape and at 200% zoom**, not only at mobile portrait width. No fixed
  heights that could clip content: if something doesn't fit, the page scrolls, it doesn't
  disappear.
