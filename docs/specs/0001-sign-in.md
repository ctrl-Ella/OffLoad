# 0001 — Signing in: the phone, Google, and the door they share

| | |
|---|---|
| **Status** | Draft |
| **Area** | backend |
| **Issue** | #NN |
| **Date** | 2026-09-19 |

---

## Problem

The application does not know who is in front of it, and it holds no permission over anyone's Google. Mia cannot read Elvia's or Carlos's calendars, and no screen can tell the two of them apart.

Three separate gaps sit behind that, with three different lifetimes:

- **Proving the line is yours** happens once, takes a few seconds, and is the cheapest identity there is on a phone: no password to remember, no account to create.
- **Knowing who you are** lasts as long as a browser session.
- **Holding permission over your Google** lasts until you revoke it, survives signing out, and is what lets Mia look at a calendar at seven in the morning with nobody holding a phone.

The Postgres schema already reflects the split — `Verification`, `Session` and `GoogleAccount` — and none of those tables holds a row yet.

---

## Acceptance criteria

### The shared door

- [ ] One screen carries both ways in: the phone number as the main path, Google as the alternative
- [ ] Someone already signed in never sees that screen; they land on their own day
- [ ] The whole screen works with the keyboard alone, with focus visible at every step
- [ ] Both paths end in the same place: a row in `sessions` and the person's day on screen

### The phone

- [ ] Elvia types her number, silent verification confirms the line, and she is in without typing a code
- [ ] When silent verification cannot complete — desktop browser, no mobile data — the screen says what happened and offers the other way in
- [ ] A number belonging to no `Person` completes verification and **still opens no session**: the attempt is recorded, and the message says access is granted from inside the household
- [ ] The number is never stored in the clear: `phoneHash` holds the digest and `phoneTail` the last digits

### Google

- [ ] Elvia taps "Sign in with Google", picks her account, and comes back signed in
- [ ] A Google account matching no `Person` in the `CORE` circle is refused, and no row is created
- [ ] After signing in, a row exists in `google_accounts` with a non-empty `refresh_token`
- [ ] Signing out and back in leaves the `refresh_token` valid: reconnecting is not needed
- [ ] A server-side call exchanges the refresh token for an access token and lists that person's calendars

### Both

- [ ] The session cookie is `httpOnly`, `secure` in production and `sameSite=lax`, and its value contains nobody's identifier
- [ ] Signing out deletes the row in `sessions`: the same token stops working even if someone had copied it
- [ ] No log line contains a phone number, an address, a name or a token

---

## Scope

**The sign-in screen**, carrying both paths. The phone is the main one and Google the alternative, which is the order the internal prototype settled on and it is worth keeping: on a phone, proving the line is yours is faster than picking a Google account.

**Silent verification with Vonage**, ported from the prototype where it already works: starting the attempt, the browser leg, the return, and the failure path when the line cannot be checked silently.

**The Google authorisation flow**, end to end: the outbound link, the callback, exchanging the code, and storing the refresh token. Four permissions asked for together, because splitting them across two screens doubles the friction and buys nothing at this scale:

| Permission | What it is for |
|---|---|
| `openid`, `email` | Knowing who came back from the callback |
| `calendar.events` | Reading the day and writing an event once someone confirms |
| `tasks` | The shopping list and the reminders |

**The application's own session**: an opaque token in a cookie, a row in `sessions`, and the server function that answers "who is making this request". Both doors end here.

**The environment example file**, which `.gitignore` has reserved with `!.env.example` from the start and which was never written.

---

## Out of scope

**Reading from or writing to Calendar and Tasks.** This work ends with the permission granted and proves it works by listing calendars. Using it for real belongs to the Mastra tools.

**The SMS fallback for verification.** When silent verification cannot complete, the screen offers Google and says so. Adding a code by SMS means a second input, a second state and a second failure path, for a demo where both accounts are ours and the browser is known.

**Refreshing the access token from the client.** The refresh token lives on the server and is used on the server. The browser never sees a Google token.

**Encrypting the refresh token at rest.** The comment on `GoogleAccount` already records this as deliberate technical debt, and this is not the weekend to pay it off. What does belong here is the consequence: the production database is sensitive material and gets treated as such.

**Creating people at sign-in, by either door.** Deliberately not, and the reasoning is below.

**Extending sessions that are about to expire.** `expiresAt` is set at creation and never pushed forward. Thirty days covers the weekend with room to spare.

**Linking the two doors to one another.** Someone who signs in by phone and later connects Google ends up with both on the same `Person`, because the `Person` already exists and both paths look it up. Nothing extra is built for it.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| One screen holds both doors, with the phone first | A landing page with a "Get started" button in front | Signing in and arriving are the same moment here: there is no password and no account to create, so a screen in between decides nothing. This is what the internal prototype arrived at after building it the other way |
| Verification runs on the practice Vonage application, under `VONAGE_VERIFY_*` | Moving verification onto the project's own application | Silent auth already works there, and moving it would mean redoing the setup that makes it work. Verify v2 authenticates with a signed JWT, so each application needs its own id **and its own private key file** — this is not two API keys. Separate variables because `VONAGE_APPLICATION_ID` is already taken by the video application |
| Both doors **look up** a `Person` and refuse when they find none | Creating the `Person` on first sign-in | The repository is public and so is the URL. Automatic sign-up means anyone in the world with a Google account, or any phone line that verifies, walks into Elvia's household. The schema says it outright: "a person exists because the family added them". A verification proves the line is yours, not that you belong to this household |
| A failed silent verification offers Google, and says what happened | Falling back to an SMS code | The demo numbers start with `990`, which makes them Network Registry Playground lines: a virtual operator serves them, they receive no SMS, and Vonage rejects the whole request with a 422 if the workflow carries any channel besides `silent_auth`. Checked against the API on 2026-09-15 and recorded in the internal prototype. So the fallback is not a choice here — and the other door is already on the same screen |
| Write the Google flow against the schema that exists, with `google-auth-library` | Auth.js (NextAuth) with its Prisma adapter | The adapter brings its own schema — `User`, `Account`, `Session` — and `Person`, `GoogleAccount` and `Session` are already written here, with decisions the adapter does not honour: an opaque token instead of a JWT, and a `Person` existing before anyone signs in. Bending the adapter to that model costs more than the flow itself. Google's library is needed anyway to refresh the token when calling Calendar |
| `access_type=offline` **and** `prompt=consent` on every outbound request | `access_type=offline` alone | Google hands over the refresh token the first time an account authorises the application and returns it empty afterwards. Without `prompt=consent` the failure shows up as "it worked yesterday" on demo day, with a row holding an empty string and no error in sight |
| An opaque session token from `crypto.randomUUID()`, in its own row | A signed JWT carrying the person id | This comes from the schema: signing out is deleting a row, and a JWT cannot be invalidated before it expires. For a demo where someone may want to switch person mid-run, that matters |
| The redirect URI is derived from `PUBLIC_URL` | Hard-coding it per environment | It is the same value that governs the Vonage and Make webhooks, and the deployment guide says as much: moving from the tunnel to Railway leaves one place to touch |

---

## Contract

**The screen**: `/`. A server component, because the question that decides what to paint — who you are — can only be answered by the server: the session lives in an `httpOnly` cookie the browser cannot read.

**Routes**, all server-side:

| Route | What it does |
|---|---|
| `POST /api/verification/start` | Takes a number, starts the silent attempt, returns where the browser has to go |
| `GET /api/verification/check` | The return leg: confirms the line, looks up the `Person`, opens the session |
| `POST /api/verification/failed` | Records that the silent path could not complete, so the screen can offer the other door |
| `GET /api/auth/google` | Generates `state`, stores it in a short-lived cookie, redirects to Google |
| `GET /api/auth/google/callback` | Validates `state`, exchanges the code, looks up the `Person`, writes `GoogleAccount` and `Session` |
| `POST /api/auth/logout` | Deletes the row in `sessions` and clears the cookie |

**Server functions**, in one module: `openSession(personId)`, `currentPerson()` and `closeSession()`. `currentPerson()` is the only place a cookie is turned into an identity.

**New variables** in `.env.example`:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PUBLIC_URL=                        # the redirect URI is derived from this, and
                                   # silent auth needs it reachable from a phone

VONAGE_VERIFY_APPLICATION_ID=      # the practice application, where silent
VONAGE_VERIFY_PRIVATE_KEY_PATH=    # auth already works. A JWT, not an API key

TEST_PHONE_ELVIA=                  # demo numbers, seeded against the two people
TEST_PHONE_CARLOS=
```

---

## Verification

```bash
npm run db:migrate
npm run dev
```

1. In Google Cloud Console: register `<PUBLIC_URL>/api/auth/google/callback` as an authorised redirect URI, add both addresses as test users, and check the consent screen asks for all four permissions.
2. Seed two people in the `CORE` circle: Elvia with `aprender2426@gmail.com` and `TEST_PHONE_ELVIA`, Carlos with `carlosmartinezgutierrez55@gmail.com` and `TEST_PHONE_CARLOS`.
3. Open `/` on a phone over mobile data, type Elvia's number, and check she gets in without typing a code.
4. Open `/` on a laptop, try the same number: silent verification cannot complete, and the screen has to say so and offer Google.
5. Sign in with Google as Elvia. In `npm run db:studio`, check there is a row in `google_accounts` with a non-empty `refresh_token`.
6. Try both doors with a number and an account that belong to nobody in `people`: both have to refuse, and `people` has to hold exactly the rows it held before.
7. Sign out and back in, and check the previous refresh token still works.
8. Walk the whole screen with `Tab` and `Enter`, no mouse.
9. Read the terminal output: no phone number, address or token may appear in it.

---

## Notes

**The internal prototype is the source of truth for silent verification, not anyone's memory of the Vonage API.** It works there, against the practice application. Vonage's documentation MCP was unreachable while this was written, and half the examples in circulation belong to the older TokBox generation, so the parameters come from the code that runs rather than from recollection.

**This depends on the migration being applied.** `0_init` exists and has not run against any database yet.

**Calendar and Tasks are sensitive scopes for Google**, which on an unverified application means Testing mode with declared test users. Refresh tokens are short-lived there — my understanding is a few days, and the exact figure is worth reading in Google's own documentation rather than taking from here. It does not get in the way over a weekend; it is worth knowing before it shows up as a failure with no apparent cause.

**Google's consent screen lets people untick permissions one by one.** That is why `GoogleAccount.scope` stores what was granted and not what was asked for. Whoever builds the Mastra tools needs to be able to ask what is actually there, rather than assume it.

**One question left open for whoever builds the interface:** what is shown when someone signs in with calendar permission but without tasks. This work stores the data needed to decide; the answer belongs to that screen's spec.
