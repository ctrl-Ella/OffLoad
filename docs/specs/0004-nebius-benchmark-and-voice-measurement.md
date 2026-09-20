# 0004 — The Nebius benchmark comes into the repo, and the voice measurement closes

| | |
|---|---|
| **Status** | Draft |
| **Area** | ia · qa |
| **Issue** | #24 |
| **Date** | 2026-09-20 |

---

## Problem

The evidence that Nebius Token Factory does real work in this product exists, and it is in the
wrong place. The benchmark, the five-model comparison from 2026-09-18 and the seven runs behind it
live in the team's previous repository, in a folder that is outside git. Someone who opens the
repository we submit sees none of it.

And the accuracy figure that does exist was measured with **written sentences only**. Nobody has
ever checked what happens when the same classifier reads what a person actually said out loud,
which is the only way the product is ever used. The thirty recordings are made — that is the one
step that cannot be automated — and they are sitting unused.

Without both halves there is no answer to the challenge's own words: a measurable improvement in
quality, grounding, evaluation, speed, cost or reliability, shown from the working project.

---

## Acceptance criteria

- [ ] `npm run bench:dry` runs from the repository root and writes a report, without an API key
- [ ] An unknown `--suite` exits with a non-zero code and names the valid ones, instead of quietly
      measuring intent
- [ ] A cases file that does not match its suite is rejected before the first API call, rather than
      producing a 0% that looks like a result
- [ ] `npm run bench:transcribe -- --dry` prints the thirty pairings and sends nothing
- [ ] The pairing aborts before touching the network if the number of audio files does not match
      the number of cases
- [ ] Interrupting the transcription halfway and running it again resumes where it left off
- [ ] `bench/cases/intent-voice.json` is not written while any transcript is missing or empty,
      unless `--partial` is passed, which declares the real sample size in the file itself
- [ ] The accuracy over written sentences and over transcribed sentences are both in `bench/results/`,
      from the same model on the same day, and the difference is written down with its `n`
- [ ] `npm run lint`, `npm run typecheck` and `npm run build` are green
- [ ] `git ls-files` returns no audio file

---

## Scope

Port the benchmark to `bench/`, inside git, with its 36 cases and the 14 result files from
2026-09-18. Fix the three defects it carries. Write the script that turns the thirty recordings
into transcripts through the product's own route. Run the classifier over both inputs and write
down the difference, with the documentation the challenge needs.

---

## Out of scope

- **Mastra and the two agents.** `interpreter` and `negotiator` stay unported. The product calls
  Nebius with `fetch` from `src/app/api/structure-plan/route.ts` and that is what gets documented.
- **The product's voice path.** `src/app/api/transcribe/route.ts` is not touched. The measurement
  goes through it, which is the whole point.
- **Moving `NEBIUS_*` into `src/lib/env.ts`.** It is the one integration that reads `process.env` at
  the door of the route. That is a decision, written as one, not a gap to close this weekend.
- **The `-fast` mode.** It answers `404` — it is a dedicated deployment, not a public one.
- **Rewriting the benchmark's HTTP client.** See the decision below.

---

## Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| The benchmark stays a standalone npm package with its own `node_modules` | Fold it into the root `package.json` and rewrite its client with `fetch` | `openai@4` declares `peer zod ^3.23.8` and the root pins `zod 4.6.4`. But the real reason is that rewriting the measuring instrument the day before measuring with it trades a bounded risk (one documented install step) for an unbounded one: a subtle bug in the SSE parsing gives wrong figures that nobody catches. The benchmark is already validated by seven real runs |
| `--suite` and `--cases` become separate flags | Keep one flag and overwrite the cases file for the voice run | Overwriting the original is how the baseline gets lost. Separating them is what makes the two runs comparable, and it is four lines |
| The transcription script goes through `POST /api/transcribe` | Extract the batch logic to `src/lib/`, or reimplement it in the script | Going through the route makes the claim literally true: same endpoint, same model code, same config, same polling loop. A second implementation would drift from the route and the figure would stop describing the product. Extracting is better engineering and a worse weekend decision — it touches the voice path for no gain in the measurement |
| The result file is named after the cases file | Name it after the suite, as before | Two runs of the same suite over different inputs came out with indistinguishable names. That is the mistake that gets made at two in the morning |
| The audio lives in `docs-internos/bench-audio/`, never in `bench/` | Keep it beside the cases it pairs with | `bench/` is inside git and this repository is public. It is a real person's voice, so it is personal data. Text travels, audio does not |

---

## Verification

```bash
npm --prefix bench install

# the benchmark runs and writes, without spending a token
npm run bench:dry

# the three defects, one by one
npm run bench -- --suite nope --dry                                   # exits 1, names intent|grounding
npm run bench -- --suite intent --dry --cases bench/cases/grounding.json   # schema error, not a 0%
npm run bench -- --suite intent --dry --cases cases/nothere.json      # error listing the paths it tried

# the pairing, before spending eight minutes on it
npm run bench:transcribe -- --dry

# one clip before thirty, with the app running
npm run dev
npm run bench:transcribe -- --only i01

# the thirty, and the resume
npm run bench:transcribe
# interrupt with Ctrl+C and relaunch: it has to carry on, not start over

# the two runs, same model, same day
npm run bench -- --suite intent --models "$MODEL" --conc 5
npm run bench:voice -- --models "$MODEL" --conc 5

# the repository stays clean. This one is not optional: the repo is public
git ls-files bench | grep -iE '\.(m4a|wav|webm)$'    # has to come back empty
npm run lint && npm run typecheck && npm run build
```

---

## Notes

- The measurement's four steps are described in the SLNG guide. Step 1, recording, is done: thirty
  clips, one sentence each, same phone throughout.
- **The trap to avoid**, and it goes in the write-up: the dictation on screen is not compared
  against the benchmark's accuracy. The benchmark uses its own prompt and a narrower schema, so
  that subtraction compares two different things. What is compared is the same classifier over a
  written sentence and over a transcribed one — only the input path changes.
- The recorder numbers its own files starting at 025, and 025 is sentence `i01`. The offset is
  derived in code rather than written down, so a recorder that starts elsewhere still works.
- The Nebius region moves from Finland to France on 2026-09-21. Both runs go on the same day, and
  the prices get read from the console again before any cost figure is published.
