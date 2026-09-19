# 0001 — Sign in with Google and connect the calendar

| | |
|---|---|
| **Status** | Draft |
| **Area** | backend |
| **Issue** | #NN |
| **Date** | 2026-09-19 |

---

## Problem

Mia reads Elvia's and Carlos's calendars and tasks. Today she cannot: the application does not know who is in front of it, and it holds no permission over anyone's Google.

These are two separate gaps, and it is worth separating them from the start, because they have two different lifetimes:

- **Knowing who you are** lasts as long as a browser session.
- **Holding permission over your Google** lasts until you revoke it, survives signing out, and is what lets Mia look at a calendar at seven in the morning with nobody holding a phone.

The Postgres schema already reflects that split — `Session` on one side, `GoogleAccount` on the other — and neither table holds a single row yet.

---

## Acceptance criteria

- [ ] Elvia taps "Sign in with Google", picks her account, and comes back to the application signed in
- [ ] A Google account matching no `Person` in the `CORE` circle is refused, with a message explaining that access is granted from inside the household, and no row is created
- [ ] After signing in, a row exists in `google_accounts` with a non-empty `refresh_token`
- [ ] Signing out and back in leaves the `refresh_token` still valid: reconnecting is not needed
- [ ] A server-side call exchanges the refresh token for an access token and lists that person's calendars
- [ ] The session cookie is `httpOnly`, `secure` and `sameSite=lax`, and its value contains nobody's identifier
- [ ] Signing out deletes the row in `sessions`: the same token stops working even if someone had copied it
- [ ] The whole flow works with the keyboard alone, with focus visible at every step
- [ ] No log line contains anyone's address, name or token

---

## Scope

**The Google authorisation flow**, end to end: the outbound link, the return to the callback, exchanging the code, and storing the refresh token.

**Four permissions, asked for together**, because splitting them across two screens doubles the friction and buys nothing at this scale:

| Permission | What it is for |
|---|---|
| `openid`, `email` | Knowing who came back from the callback |
| `calendar.events` | Reading the day and writing an event once someone confirms |
| `tasks` | The shopping list and the reminders |

**The application's own session**: an opaque token in a cookie, a row in `sessions`, and the server function that answers "who is making this request".

**The environment example file.** `.gitignore` has reserved its slot with `!.env.example` from the start and the file was missing, so anyone cloning the repository had no way of knowing which variables are needed. It lands here with the ones this work needs, ready for the rest to be added on top.

---

## Out of scope

**Refreshing the access token from the client.** The refresh token lives on the server and is used on the server. The browser never sees a Google token.

**Reading from or writing to Calendar and Tasks.** This work ends with the permission granted and proves it works by listing calendars. Using it for real belongs to the Mastra tools.

**Signing in by phone with Vonage Silent Auth.** That is the other door and has its own spec. The schema already covers it with `Verification`, and both doors end up creating a row in `sessions`, so they share the bottom half and nothing else.

**Encrypting the refresh token at rest.** The comment on `GoogleAccount` already records this as deliberate technical debt, and this is not the weekend to pay it off. What does belong here is the consequence: the production database is sensitive material and gets treated as such.

**Creating people at sign-in.** Deliberately not. It is the second acceptance criterion and the reasoning is below.

**Extending sessions that are about to expire.** `expiresAt` is set at creation and never pushed forward. Thirty days covers the weekend with room to spare.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| Write the OAuth flow against the schema that already exists, using `google-auth-library` for the exchange and the refresh | Auth.js (NextAuth) with its Prisma adapter | The adapter brings its own schema — `User`, `Account`, `Session` — and `Person`, `GoogleAccount` and `Session` are already written here, with decisions inside them the adapter does not honour: an opaque token instead of a JWT, and a `Person` existing before anyone signs in. Bending the adapter to that model costs more than the sixty lines of the flow. Google's library is needed anyway to refresh the token when calling Calendar, so this adds no dependency we were not going to carry |
| The callback **looks up** a `Person` by address and refuses when it finds none | Creating the `Person` on first sign-in | The repository is public and so is the URL. Automatic sign-up means anyone in the world with a Google account walks into Elvia's household. The schema already says it outright: "a person exists because the family added them" |
| `access_type=offline` **and** `prompt=consent` on every outbound request | `access_type=offline` alone | Google hands over the refresh token the first time an account authorises the application, and returns it empty on subsequent sign-ins. Without `prompt=consent` the failure shows up as "it worked yesterday" on demo day, with a row saved holding an empty string and no error anywhere in sight |
| An opaque session token from `crypto.randomUUID()`, stored in its own row | A signed JWT carrying the person id | This comes from the schema and the reason is in its comment: signing out is deleting a row, and a JWT cannot be invalidated before it expires. For a demo where someone may want to switch person mid-run, that matters |
| All four permissions on a single consent screen | `openid email` at sign-in, Calendar later when needed | Incremental authorisation is right when some people only want to sign in. Here signing in without connecting a calendar does nothing: the calendar is the entire product |
| The redirect URI is derived from `PUBLIC_URL` | Hard-coding it per environment | It is the same value that already governs the Vonage and Make webhooks, and the deployment guide says as much: moving from the tunnel to Railway leaves one place to touch |

---

## Contract

**Three routes**, all server-side:

| Route | What it does |
|---|---|
| `GET /api/auth/google` | Generates `state`, stores it in a short-lived cookie, redirects to Google |
| `GET /api/auth/google/callback` | Validates `state`, exchanges the code, looks up the `Person`, writes `GoogleAccount` and `Session`, sets the cookie |
| `POST /api/auth/logout` | Deletes the row in `sessions` and clears the cookie |

**One server function**, `currentPerson()`: reads the cookie, finds the live session, returns the `Person` or `null`. It is the only place a cookie is turned into an identity.

**New variables** in `.env.example`:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PUBLIC_URL=http://localhost:3000   # the redirect URI is derived from this
```

---

## Verification

```bash
npm run db:migrate
npm run dev
```

1. In Google Cloud Console, register `<PUBLIC_URL>/api/auth/google/callback` as an authorised redirect URI on the OAuth client, and add Elvia's and Carlos's addresses as test users. Check the consent screen asks for all four permissions.
2. Insert a `Person` in the `CORE` circle by hand, with Elvia's address.
3. Open the application, tap "Sign in with Google" and pick that account.
4. In `npm run db:studio`, check there is a row in `google_accounts` and that `refresh_token` is not empty.
5. Repeat with a Google account that is not in `people`: it has to refuse, and `people` has to hold exactly the rows it held before.
6. Sign out, sign back in, and check the previous refresh token still works.
7. Walk the whole flow with `Tab` and `Enter`, no mouse, checking focus is visible at each step.
8. Read the terminal output: no address and no token may appear in it.

---

## Notes

**This depends on the migration being applied.** `0_init` exists but has not run against any database yet, so step one of the verification is not optional.

**Calendar and Tasks are sensitive scopes for Google**, which on an unverified application means working in Testing mode with declared test users. Refresh tokens are short-lived there — my understanding is they expire after a few days, and the exact figure is worth reading in Google's own documentation rather than taking from here. It does not get in the way over a weekend; it is worth knowing before it shows up as a failure with no apparent cause.

**Google's consent screen lets people untick permissions one by one.** That is why `GoogleAccount.scope` stores what was granted and not what was asked for. Whoever builds the Mastra tools needs to be able to ask what is actually there, rather than assume it.

**One question left open for whoever builds the interface:** what is shown when someone signs in with calendar permission but without tasks. This work stores the data needed to decide; the answer belongs to that screen's spec.
