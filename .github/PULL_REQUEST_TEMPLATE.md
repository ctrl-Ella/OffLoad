## What it does

<!-- One or two sentences. If you need more, this may be two pull requests. -->

closes #

## Why

<!-- The context the code does not show. What was rejected and why, if it matters. -->

## How to check it

<!-- The steps whoever reviews will follow. They should stand on their own. -->

1.
2.
3.

## Before asking for review

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] The **spec** in `docs/specs/` is up to date (or does not apply, and I say so below)
- [ ] The **documentation** affected is up to date
- [ ] The **CHANGELOG** has a line about this
- [ ] The body carries `closes #NN` with the real number
- [ ] No keys, tokens or `.key` files in the diff

## If it touches the interface

- [ ] Usable with the keyboard alone, and the focus is always visible
- [ ] Checked at **200% zoom**
- [ ] Checked on **mobile in landscape** (height failures do not show up by testing widths)
- [ ] Decorative icons carry `aria-hidden`; icon-only buttons carry `aria-label`
- [ ] Contrast at least 4.5:1 for body text and 3:1 for large text and graphics, if I touched colours
- [ ] Looks right on mobile, on a laptop screen and on a large display

---

<!--
Reminder: whoever writes the code does not approve their own pull request.

During the hackathon GitHub no longer enforces it, so it is on us. That a machine
does not check it does not make it optional: it makes it ours.
-->
