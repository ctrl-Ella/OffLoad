# OFFLOAD

Built by team CTRL4ELLA for HackBarna AI Summit 26.

This file is the context any Claude Code session needs in order not to reopen decisions that are already made. If a proposal contradicts something here, the proposal is wrong.

It applies to a local session and to a cloud session alike. If you are reading this from a remote machine, read the **How we work** section in full before touching anything.

---

## What it is

A family app that shares out the mental load. Mia, the agent, finds the problems before anyone sees them, resolves on her own whatever changes nobody's plans, and only asks for a yes or a no when it matters. What it gives back, measured, is time.

The interface is mobile first and the main input is voice.

## The people

| Name | Role | What Mia sees of them |
|---|---|---|
| Elvia | Uses the app | Full calendar and tasks |
| Carlos | Her partner | Full calendar and tasks |
| Nicolás, grandma Rosa, neighbour Marta | Support network | Name and phone number only |
| Mia | The agent | — |

**Two circles, and the difference is structural.** The core connects their Google accounts and Mia sees their calendars. The support network only exists in the contact list: Mia sees nothing of theirs, cannot know whether they are free, and **never claims they are available**. Finding out means calling them, and that is why the video call exists.

---

## The rule that decides almost everything

> **Does this change anyone's plans?**

- **It does not** → Mia does it herself and says so. Attaching an errand to a trip someone was making anyway, reordering reminders, building the shopping list.
- **It does** → Mia prepares the whole thing and asks for a yes or a no. One card, two buttons.
- **A yes or a no will not settle it** → video call. It is the exception, and how rarely it happens is the measure of success.

---

## The technical thesis

> **The model interprets, the workflow decides.**

Working out that two stops collide is arithmetic over times and distances, and you do not ask a language model for that. The model gets only what a deterministic machine cannot do: understanding a sentence said out loud, and choosing who is the right person to ask.

Of the eight steps in a run, only two touch a model — and the one that decides the most touches none.

---

## Architecture

**One workflow**, `resolveConflict`. A state machine persisted in Postgres. It suspends waiting for a person and resumes at the exact step. A conflict is one of its states, not an error.

**Two agents**, and there is no third:

- `interpreter` · small model · turns speech into typed intent
- `negotiator` · large model · builds the proposal and writes it

**Six tools**, every one with a Zod schema: `readCalendar`, `createStop`, `writeEvent`, `writeTask`, `openCall`, `addParticipant`.

The agents do not talk to each other. They talk through the workflow.

## Who does what

| Piece | Owns | Does NOT do |
|---|---|---|
| **Mastra** | Orchestration, state, typed tools | Talk to the model directly, or write to calendars |
| **Nebius** | All the reasoning, at two tiers | Decide — and not audio either: its catalogue is text |
| **Vonage** | The video session, Live Captions, Nicolás's SIP leg, Silent Auth | The logic. Outside the core it is the only way to reach anyone |
| **SLNG** | Everything Mia says and hears outside the call | Understanding: it returns text, Nebius interprets it |
| **Google** | Calendar and Tasks for the core | The support network, which connects nothing |
| **Make** | The side effects of a decision already taken | Reasoning, or choosing who gets asked what |

**The border between Mastra and Make:** if Mia needs the result to keep reasoning, or to show something on screen now, it is a Mastra tool. If it is a consequence that can happen a minute later, it is Make.

---

## Rules that do not bend

These are covered by tests and they block the merge.

1. **Nothing is ever written to a calendar without human confirmation.**
2. **Mia does not speak unless someone has given her the floor.** She asks for it, her tile lights up, and she waits.
3. **Nobody in the support network is ever described as available.** Outside the core, the correct state is "I don't know".
4. **Mia announces nothing that is not true yet.** Taking something off someone's plate and then not delivering is worse than never having offered.
5. **Proximity is measured between stops, never between people.** Nobody's real location is used.
6. **Time-saved figures are either computed or declared as estimates.** No number gets inflated.

---

## Code conventions

- **TypeScript.** The app is Next.js, the orchestration is Mastra.
- **Structured output, always.** `response_format: { type: "json_schema" }` on every Nebius call. It turns on constrained decoding in vLLM: the model cannot break the schema. No defensive parsing, no format retries.
- **Zod with `.describe()` on every field.** The schema is the prompt. Fewer mile-long instructions.
- **Model identifiers never live in the code.** They come from the environment. Nebius retires checkpoints without redirecting traffic.
- **In Mastra, model names carry the `nebius/` prefix.** In the Token Factory API they do not.
- **Tier by load:** `-fast` inside the video call, `base` everywhere else, Batch API for the weekly summary.
- **Quota headers.** Read `Retry-After`, and switch from `-fast` to base on sustained failures.
- **Everything is in English.** Prose, code, identifiers, branch names, commit messages, issues, pull requests and product copy.

---

## Before writing Mastra or Vonage code

Both platforms move faster than any model's training data. **Check their documentation MCP before proposing an API**, rather than writing from memory. They are configured in `.mcp.json`.

This is not optional: half the Vonage examples in circulation belong to the older TokBox generation, and the Mastra API changed shape recently.

---

## How we work

### Nothing reaches the remote without Irina's go-ahead

`git push`, opening a pull request, publishing to any external service, deploying: **ask, and wait for the answer**. Announcing it while you do it does not count. Local commits, as many as you like.

The reason is that this repository is public. A push cannot be undone, only patched over.

### What never goes into git

- **`.env` and every variant of it.** What is versioned is `.env.example`, without a single real value.
- **Vonage's `private.key`, and any `.key` or `.pem`.** On Railway the key travels as an environment variable and the process writes it to disk at start-up.
- **`/docs-internos`.** The brief and the reference archives stay out: only distilled material travels here.

If a secret turns out to be committed, the key is burnt even if you delete the file: it has to be rotated. Say so the moment you see it.

### How we write here

Everything written in this repository is public and signed by the team: issues, pull request descriptions, review comments, specs, decisions and documentation.

**Who reads it.** The hackathon jury. The sponsors, checking whether their platform was used with judgement. A developer joining today with no context. Someone external who lands on the repository and forms a view of the team from how it reads. Text that works for all four is text that is well written.

**The register is assertive**, which is neither harsh nor soft. State the whole problem, explain why it matters, propose a way out. Both extremes fail equally: the curt comment that saves words at the reader's expense, and the one so softened that the other person never realises something needs changing.

The concrete rules:

- **Nothing framed as a shortfall.** Limits are decisions, so they read as decisions. "We dropped the cache because it optimises at scale and there is no scale here" says more about a team than not mentioning it. "We ran out of time" says less than "that time went to the critical path".
- **No self-praise, and no self-deprecation.** Both talk about the writer instead of the work. The middle ground is precision: "the classifier is right 93% of the time across thirty real cases", not "works pretty well" and not "a seriously powerful architecture". A checked number convinces more than any adjective.
- **Talk about the code, never the person.** "This method does two things", not "you mixed up responsibilities".
- **Every point raised carries its reason and a proposal.** Without the reason, a correction is an order.
- **In a review, say "blocking" and "suggestion" in those words.** The person receiving it should know without asking what has to change for approval.
- **It reads without having been there.** The reader did not live the day it happened, and does not know what those initials mean.
- **No minimisers, no irony.** "Just", "you only need to", "obviously" and "it's trivial" make anyone who cannot see it feel slow. Sarcasm in writing is indistinguishable from reproach.
- **Everything in English**, prose and code alike, and the register is the same throughout.

The check before publishing anything is two questions: **would any of those four people find this pleasant to read? Does it read without having been there?** If either answer is "not quite", the text is not finished.

### Branches

```text
main                 production: what is stable, what ships
 └── dev             where we work: everything goes through here
      └── feature/12-video-room
```

**Nobody works directly on `main` or `dev`.** Every branch comes off an up-to-date `dev` and carries its issue number in the name. Pull requests always go **to `dev`**, never to `main`. `dev` to `main` is a separate pull request, and that is a release.

One consequence worth keeping in mind: GitHub only closes issues from `closes #12` when the pull request targets the default branch, which here is `main`. Since ours target `dev`, `.github/workflows/cerrar-issues.yml` handles it.

### One spec per task, before the code

**No task starts with the code.** The order is always the same:

```text
issue  →  spec  →  branch off dev  →  code  →  PR to dev  →  review  →  merge
```

The spec lives in `docs/specs/`, is written from [`docs/specs/0000-plantilla.md`](docs/specs/0000-plantilla.md) and is linked from the issue. It defines what is in, what is deliberately out, what the contract is, and how you check it works.

It earns its keep twice over a weekend: two people do not build the same piece two different ways, and a Claude Code session in the cloud can work alone without asking for the whole context again.

The full circuit is in [`docs/workflow/spec-driven-development.md`](docs/workflow/spec-driven-development.md), and the rest of the process in [`docs/workflow/`](docs/workflow/): branches and pull requests, commits, issues and labels.

### Architecture decisions get written down

When a decision closes off future options or is expensive to reverse — a database schema, a public API contract, a shared type, the route structure — it goes in [`docs/decisiones/`](docs/decisiones/), numbered, with its context, the alternatives rejected and the consequences.

It takes ten minutes to write and saves having the same argument again on Sunday morning. A decision that stops holding is not deleted: it is marked as superseded and the new one is written over it.

### The specialised agents

`.claude/agents/` holds eight profiles with their own instructions. **One per lane**, so each has clear ground and they do not tread on each other:

| Agent | Its lane |
|---|---|
| `orquestacion` | Mastra: the workflow, the two agents, the six tools and the state in Postgres |
| `razonamiento` | Nebius: the two model tiers, structured output, quota and the benchmark |
| `llamada` | Vonage: the video session, Live Captions, SIP and Silent Authentication |
| `interfaz` | The three screens, the colour tokens and everything visible |
| `automatizaciones` | Make: the five scenarios, their webhooks and the reminder store |
| `qa` | Demo data, the spoken phrases, the rehearsal and the failure plan |
| `accesibilidad` | The screen-by-screen pass against the project's bar |
| `revisor-textos` | Spelling and grammar across everything published |

Plus two skills in `.claude/skills/`: `consultar-docs-sponsors`, for the platforms' living documentation, and `voz-de-mia`, for how the agent speaks.

---

## What we deliberately do not do

- **Fine-tuning.** There is no proprietary data and the problem is one of orchestration.
- **Semantic caching.** It optimises at scale, and there is no scale here.
- **SAGA-style compensation.** With eight steps and one critical service, a manual undo covers the same ground.
- **More agents.** Two cover everything that needs interpreting.
- **Audio Connector with Pipecat.** It is where this grows, but Pipecat is a whole framework in Python.
- **The full voice agent with unmute.** The polished version, and a different project.
- **Embeddings and a reranker.** There is no corpus. It would be architecture for the photo.

---

## Where everything lives

| Path | What is inside |
|---|---|
| `docs/workflow/` | How we work: branches and PRs, commits, issues and labels, spec driven development |
| `docs/specs/` | One spec per task, plus the template |
| `docs/decisiones/` | Architecture decisions, with their context and consequences |
| `docs/guias/` | Guides by topic: accessibility, Make, deployment |
| `.claude/agents/` | The eight agents, one per lane |
| `.claude/skills/` | The platforms' living documentation, and Mia's voice |
| `.github/` | Issue and PR templates, labels, CODEOWNERS, rulesets and continuous integration |
| `scripts/configurar-github.sh` | Applies labels, the `dev` branch and the protection rules. Run once |
| `.mcp.json` | The Mastra and Vonage documentation MCPs |
| `CHANGELOG.md` | What changed. One line per pull request |

Folder names are still in Spanish. Renaming them breaks every internal link, so it is a separate job and it is not done yet.

---

## Open questions

Still unresolved, and worth closing before they get expensive.

- **The child needs a name.** He shows up on screens, in notifications and in Mia's voice. Once it is decided, it gets written here and stops being discussed.
- **Required approvals are set to zero** on `main` and `dev` for the duration of the hackathon. A pull request and green CI are still enforced. Another person reviewing is still the team's agreement — there is simply no machine checking it now, and turning it back on afterwards is the first thing to restore.
- **`/api/health` does not check Postgres yet.** It reports that the process is alive and says so in those words. Once the database client exists it has to run a real query: the app can be up with the database down, and that is exactly what a health check is for.
