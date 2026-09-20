# 0003 — A real phone number on `Person`, for the support network only

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-20 |

## Context

`Person` never stored a phone number in the clear: `phoneHash` holds a salted digest and
`phoneTail` the last few digits, enough to confirm a verification and to show which line is whose
on screen, never enough to dial or text it. That was correct for what the schema existed to do —
prove a line belongs to whoever is signing in.

Mia now needs to actually reach someone in the support network: on command, during a call, she
sends an SMS inviting them to join, with a link. A hash cannot receive a text message. The
persona table in `CLAUDE.md` already says the support network exists in the app as "name and
phone number" — the number was always meant to be real, it just never had anywhere to live.

## Decision

One nullable column, `Person.phone`, storing the number as given — no hash, no digest.

- **Populated only for the support network.** The core is reached through the app itself, signed
  in; it has no reason to be texted, so the column stays null for them.
- **Set once, by whoever adds the person to the household** — never derived from a verification.
  A support-network member never verifies their own line the way the core does, so there is no
  path by which completing a verification could populate this column as a side effect. Keeping
  the two entirely separate means confirming a line never has the accidental effect of publishing
  a real number that person did not choose to give the app.
- **Not logged.** Same rule the codebase already applies to `email` and to a raw phone number
  anywhere else: personal data does not appear in a log line.

## Consequences

**For:** the one missing piece for reaching the support network by text now exists, with nothing
else about `Person` changed. Existing rows are unaffected — the column is nullable and the core's
rows simply never populate it.

**Against:** a second, unhashed way to hold a phone number on the same model as `phoneHash`,
which someone reading the schema for the first time has to notice is deliberate and not a
leftover from before hashing was added. The comment on the column says so directly, for that
reason.

**What still depends on this column being correct:** an SMS invite is only as good as the number
stored here. Nothing in this change validates the number's format or confirms it is reachable —
that is the concern of whoever writes it (a household-management screen, today done by hand
against the seed data) and of the SMS-sending code itself, which finds out for certain when
Vonage answers.

## Alternatives rejected

**A separate `Contact` table for support-network numbers, apart from `Person`.** Rejected: this
household's contact model is already `Person` with `circle: SUPPORT`, and a second table for one
extra column would mean joining two tables everywhere a support-network person is already looked
up by their existing `Person` row.

**Deriving the real number from `phoneHash` at the moment of verification.** Not possible by
construction: `phoneHash` is a one-way digest precisely so the number cannot be recovered from it.
Even if it could, doing so would make verifying a line and publishing a real, textable number the
same action, which is exactly the coupling this decision avoids.
