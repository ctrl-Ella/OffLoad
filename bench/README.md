# Benchmark · Nebius Token Factory

Part of **OFFLOAD**, by team **CTRL4ELLA**, for HackBarna AI Summit 26.

The Nebius challenge asks that Token Factory contribute to the product's functionality **or**
demonstrate a measurable improvement in quality, grounding, evaluation, speed, cost or
reliability. This is the second one: a script that runs real product cases against several models
and modes, and reports the numbers.

One command, five figures that hold up.

---

## What it measures

| Number | Where it comes from | What it supports |
|---|---|---|
| **Classifier accuracy** | `intent` suite, 30 sentences dictated in Spanish | That the small model can carry the classification |
| **Cost per case** | Real tokens times the console's price | The routing between small and large model, as a figure instead of a hunch |
| **TTFT p50 and p95** | Streaming, time to first token | That `-fast` is used only inside the video call and nowhere else |
| **Grounding** | `grounding` suite, with and without the core's schedule | That the person proposed is genuinely free |
| **Invented availability** | The same suite | How often the model claims someone in the support network can, with no way of knowing |
| **Quota and absorbed 429s** | `x-ratelimit-*` and `Retry-After` headers | That the system survives the rolling 15-minute window |

---

## Use

The benchmark is its own npm package, with its own dependencies. Once:

```bash
npm --prefix bench install
```

Then, from the repository root:

```bash
npm run bench:dry          # spends no tokens, shows the shape of the report
npm run bench:intent       # every model in MODELS, base mode
npm run bench:grounding    # with the core's schedule against without it
npm run bench:voice        # the same classifier over the transcribed sentences
```

Individual options:

```bash
npm run bench -- --suite intent --models "Qwen/Qwen3-30B-A3B-Instruct-2507"
npm run bench -- --suite intent --conc 5
npm run bench -- --suite intent --cases cases/intent-voice.json
```

`NEBIUS_API_KEY` comes from the repository's `.env`; nothing needs exporting by hand.

Every run leaves a JSON with the detail and a `.md` with the table in `results/`. The file name
comes from the **cases file**, not from the suite, so two runs of the same suite over different
inputs can be told apart — which is exactly what the voice measurement needs.

### The suite and the cases are two different flags

`--suite` picks the corrector: the prompt, the schema and how an answer is marked. `--cases` picks
the data. They used to be the same flag, and that meant the only way to run the classifier over
transcribed sentences was to overwrite the original file. An unknown suite now exits rather than
quietly falling back to `intent`, and a cases file that does not match its suite is rejected before
the first call — pointing `--cases` at the wrong file used to produce a publishable 0% that looked
like a result.

---

## Ask for the live model list first

The Token Factory catalogue moves and Nebius retires checkpoints without redirecting traffic, so a
hard-coded identifier is a future outage:

```bash
curl -H "Authorization: Bearer $NEBIUS_API_KEY" $NEBIUS_BASE_URL/models
```

The four in `MODELS` are a starting point: three small or fast candidates for classifying and one
large one for negotiating. They get checked against the live list before every run.

A difference that misleads people: in Mastra these same models carry the `nebius/` prefix, which is
how it routes providers. In the Token Factory API they do not.

---

## Prices get filled in, not estimated

`PRICES` in `bench.ts` takes real values from the Nebius console. While any of them is zero, the
report says so and prints "no price" instead of inventing a figure.

That is deliberate: an inflated cost figure shows, and it drags the credibility of every other
number with it.

---

## The cases

**`cases/intent.json`** · 30 sentences transcribed from speech, with filler words, self-corrections
and sentences that trail off, which is what a real dictation produces. Seven labels: `parada`,
`recordatorio`, `nota`, `delegar`, `mover`, `consulta`, `compra`.

The hard cases are there on purpose: `i09` corrects itself halfway through, `i26` mixes an errand
into a trip that already existed, and `i30` looks like a new appointment but is a change of time.

**`cases/intent-voice.json`** · the same thirty, except each `text` is what SLNG transcribed from a
recording of someone reading it out loud. Same ids, same `expected`. It is written by
`npm run bench:transcribe` and never by hand. The recordings themselves stay out of the repository:
they are a real person's voice, and what the product needs is the text.

**`cases/grounding.json`** · 6 situations, and here is the nuance that makes the suite interesting.
OFFLOAD has two circles of people:

- **The core** are the ones who connected their Google account. Mia sees their calendars and knows
  whether they are free.
- **The support network** is a name and a phone number. Mia sees nothing of theirs and cannot know
  whether they are free.

So the model has three outputs: `proponer` someone from the core who is free, `llamar` someone in
the network to ask them, or `sin_salida`. And one rule that never bends: **availability can never
be asserted for the network.** Picking someone from the network with `proponer` instead of `llamar`
is inventing a fact, and the report counts it separately in the `invented` column.

That column is the hardest metric here, because models invent availability with notable cheer when
they do not have the data in front of them. Case `g04` has a partial overlap on purpose, to see
whether the model looks at the whole window or only at its start.

Every case runs twice, with the core's schedule in context and without it. The difference between
the two rates is what grounding is worth, said with a number.

---

## Implementation details worth the space

- **Structured output by schema.** Every call carries `response_format: { type: "json_schema" }`,
  which turns on constrained decoding in the vLLM engine behind Nebius. The model cannot emit a
  token that breaks the schema, so there are no format retries and no defensive parsing.
- **TTFT measured for real.** With `stream: true` and a timestamp on the first chunk that carries
  content, not total latency.
- **Real tokens.** With `stream_options: { include_usage: true }`, not estimated from text length.
- **429 and 5xx with `Retry-After`.** The header is honoured when it comes, and when it does not,
  exponential backoff with jitter.
- **Quota visible.** `x-ratelimit-dynamic-period-usage-tokens` and `x-ratelimit-over-limit` are
  read to know how much of the rolling 15-minute window is gone.
- **Model identifiers are not hard-coded.** They come from `BENCH_MODELS` or `--models`, and the
  explicit flag wins.
- **Every result carries a `meta` block** with the cases file, its sha256 and the model list. That
  is what makes a subtraction between two runs checkable by someone who was not there.

---

## Modes, and what each one is for

Token Factory returns identical results in `base` and in `-fast`; what changes is batch size,
compute per query and speculative decoding. OFFLOAD has three workloads with different needs and
uses one mode for each:

| Workload | Mode | Why |
|---|---|---|
| A proposal inside the video call | `-fast` | Mia has to propose while people are talking; first-token latency pays for itself here |
| Dictation and normal conversation | `base` | Nobody notices the difference and the token costs less |
| Friday's summary and the shopping list | Batch API | Asynchronous and latency-tolerant, up to 50% cheaper |

This benchmark is what turns that decision into a table instead of an opinion.

---

## What this benchmark does not measure

It marks **one field**: the label. The product's own extractor also pulls out a time, and a wrong
time ends up in somebody's calendar — a harder failure than a wrong label and one this suite cannot
see. So the accuracy here is **the classifier's, not the whole extractor's**, and it should be
quoted that way.

The prompt and the schema are also narrower than the product's. A number from here compared against
a number from the app would be comparing two different things. What can be compared is this same
benchmark over two inputs, which is what `bench:voice` exists for.
