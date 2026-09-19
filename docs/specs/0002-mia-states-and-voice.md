# 0002 — Mia: the character, her five states, and her voice

| | |
|---|---|
| **Status** | Draft |
| **Area** | frontend · backend |
| **Issue** | #NN |
| **Date** | 2026-09-19 |

---

## Problem

Mia is the product and she is not in it. The door says "Que lo haga Mia" and nothing on screen shows who that is. The internal prototype already has her: a drawn character with five states that each correspond to something the system knows, and a synthesised voice chosen after a casting. None of that has crossed into this repository.

Bringing her over is not a copy. The prototype's tokens, class names and identifiers are Spanish, its stylesheet layout is different from this one, and its comments carry reasoning that here belongs in a spec. The character has to land on this design system, not beside it.

---

## Acceptance criteria

### The character

- [ ] `/` shows Mia above the headline on a phone and beside it on a desktop, with no state label: nothing is running there yet
- [ ] `/system` shows the five states side by side, and a sixth Mia whose state switches with five buttons, so the transitions can be seen
- [ ] Each state is told apart by an object or by the face, never by colour alone: headphones, notebook, speech bubble, voice bars
- [ ] The label under Mia reads "Mia: <state>" to a screen reader, and the visible text is Spanish
- [ ] With `prefers-reduced-motion` on, nothing loops and nothing disappears: every state still reads
- [ ] On a touch screen the eyes do not follow anything; on a pointer they follow the cursor and return to centre when the window loses focus
- [ ] Every colour Mia uses is a token in `tokens.css` with its measured contrast beside it. No hex value lives in the component
- [ ] `npm run typecheck`, `npm run lint` and `npm run build` pass

### The voice

- [ ] `npm run mia:say -- "Buenos días" out.wav` writes a WAV that says the phrase in Silvia's voice, from an EU region
- [ ] Without `SLNG_API_KEY` the same command fails at once, naming the variable, and nothing is called
- [ ] The synthesis function accepts text from the server only. No route takes free text from a browser
- [ ] No log line carries the text Mia says or any audio

---

## Scope

**The character**, `MiaFigure` and `Mia`, ported from the prototype with English identifiers and this project's tokens. The figure is the drawing alone. `Mia` adds the sky that lifts her off the light background and the label that says what she is doing.

**The five states** and their labels, as one exported type. They are the contract between the character and whatever drives her later: the call, the dictation screen, the proposal card.

| State | Label on screen | What the system knows when it shows it |
|---|---|---|
| `quiet` | Callada | Nothing is in progress |
| `listening` | Escuchando | A transcription is running |
| `preparing` | Preparando | A tool or a model call is running |
| `asking` | Pide la palabra | A proposal is ready and waiting for the floor |
| `speaking` | Hablando | A clip of hers is playing right now |

**Her tokens**, in `tokens.css`, with the contrast figures the prototype measured.

**The door**, which gains the character and the two-column composition on desktop.

**A reference page at `/system`**, showing every state at rest and one that switches. It is where the next component's states go too.

**The voice**: the SLNG synthesis call, its environment contract, and a command-line check that writes a clip to disk. The model and voice defaults carry the casting decision over.

---

## Out of scope

**Speech to text.** A separate branch, `slng-speech_to_text`, already carries that work. Two ports of the same client would merge badly.

**A route that returns Mia's voice.** In the prototype that route does not take text: it looks up the open proposal and speaks that, because who has the floor is decided by the run. There is no run here yet, so the route would have nothing true to say. It arrives with the workflow.

**Playing the clip in the browser and tying it to `speaking`.** That is the call screen's job, and it is where rule 2 is enforced: the clip plays only when someone gives her the floor, which is also the gesture the browser needs to unlock audio.

**The in-call streaming voice.** The prototype's casting picked `cartesia/sonic:3.5` with a Cartesia voice for the phase where audio streams as it is generated, and that model is WebSocket only. The decision is recorded in the notes below and comes back with the call.

**Dark theme for Mia.** Deliberately none: she is a character, not a surface, and a logo does not invert with the hour.

---

## Decisions

| Decision | Rejected alternative | Why |
|---|---|---|
| Four of the five states keep the face, and an object tells them apart | A different expression per state | An expression claims a feeling. An object claims an activity, which is what the system actually knows: headphones for a transcription in flight, a notebook for a tool running, a bubble for a proposal waiting. Only `speaking` empties the visor, and there the voice bars are the face animating |
| The paws never move | The right paw rising to ask for the floor or to hold the notebook | It is a forty-pixel rocket fin with nothing to grip. With little angle the gesture does not read; with enough angle the paw reaches the helmet and looks like a hand to the head; anywhere between, it covers the object or the object covers it |
| The eyes follow the pointer, and only the pointer | Following touch too | Following a finger leaves the gaze stuck where it lifted, and the hand is already covering the screen. Looking is the one gesture that says nothing about the system, which is why it can follow the mouse without breaking rule 4 |
| The continuous loops are CSS, the state transitions are Motion | Everything in Motion | Inside the Motion tree every state change restarts the loop, and the flame jumps on every click. Keyframes cannot be written as Tailwind utilities, which is why `mia.css` exists next to the component |
| No frame around her | The dark bordered square from the first version | That square is a video tile, and it only means something inside a call. On a normal screen it was a window to nowhere. The sky does the job of making her visible on the light background, and fades to nothing instead of being cut |
| The sky fades with `color-mix` on its own colour | Fading to `transparent` | `transparent` is black with zero alpha, and interpolating towards it drags the gradient through a band of dirty grey that reads as a smudge |
| The label's colour is reinforcement, the word is the information | Colour alone for "has the floor" | "Pide la palabra" and "Hablando" already say it. Someone who cannot tell the teal apart reads the same thing |
| The brand tomato is `--color-alert-strong`, reused, not a second value | A `--mia-brand` with its own hex | Same colour, one place to change it. It always sits on the helmet: on the purple body it measures 1.02:1 and disappears |
| Synthesis takes a model and a voice from the environment, with defaults | Only the key, model fixed in code | The model identifier is what SLNG can retire without warning, and that rule is already in `CLAUDE.md`. The defaults are not secrets: they are the casting decision, and a decision belongs where the next person will look |
| Audio never touches disk on the server, and no log line carries the text | Caching clips by text | This synthesises what a family is told about its own house. The product needs the bytes for as long as it takes to play them and not a second more |
| A command-line check instead of a route | An `/api/mia/voice?text=` for testing | A synthesis route that takes free text is an open relay to a paid API on a public URL. The command needs the key and runs where the key is |

---

## Contract

**The contract**, `src/components/mia-states.ts`, with no `"use client"`: a server component that imports a value through the client boundary receives a reference, not the value, and `MIA_STATE_ORDER.map` stops being a function at build time.

```ts
type MiaState = "quiet" | "listening" | "preparing" | "asking" | "speaking";

const MIA_LABELS: Record<MiaState, string>;   // what is shown, in Spanish
const MIA_STATE_ORDER: MiaState[];            // the order of one full turn
const MIA_SKY: string;                        // the background that lifts her off the page
```

**The drawing**, `src/components/mia.tsx`, a client component:

```ts
function MiaFigure({ state, className? }): JSX.Element;  // the drawing alone
function Mia({ state }): JSX.Element;                     // drawing, sky and label
```

**Tokens**, in `src/app/styles/tokens.css`, all under `--mia-*`. They do not enter `@theme`: they are used as `var()` inside the SVG, never as utilities.

**Server function**, `src/lib/slng.ts`:

```ts
function synthesise(text: string): Promise<ArrayBuffer>;  // WAV, 24 kHz
```

**Environment**, in `.env.example`:

```bash
SLNG_API_KEY=                        # per project, shown once
SLNG_TTS_MODEL=deepgram/aura:2       # HTTP route. The default is the casting
SLNG_TTS_VOICE=aura-2-silvia-es      # the voice inside the model
SLNG_REGION=eu-west                  # where the audio travels. There is no eu-central
```

**Command**: `npm run mia:say -- "<text>" <file.wav>`.

---

## Verification

```bash
npm run typecheck && npm run lint && npm run build
npm run dev
```

1. Open `/` at 390 px, 1280 px and 1920 px wide, and in phone landscape. Mia is visible in all four, nothing scrolls sideways, and the headline and sign-in stay on screen.
2. Open `/system`. Five Mias at rest read as five different things. Press the five buttons under the sixth and watch the transitions: headphones drawing in, the visor melting into voice bars, the notebook sliding out of the paw.
3. Move the pointer around the sixth Mia: her eyes follow, the mouth follows less. Switch to another window: they return to centre.
4. Turn on reduced motion in the operating system and reload `/system`. Nothing floats, the flame is still, the bubble's dots stay lit, and the notebook's third line is fully drawn.
5. With a screen reader, tab to the switcher: each button announces its state and whether it is pressed, and the label reads "Mia: Pide la palabra".
6. Run `npm run mia:say -- "Del núcleo no puede nadie. ¿Llamo a Nicolás?" mia.wav` and play the file. It is Silvia, in Spanish, and the clip is whole.
7. Empty `SLNG_API_KEY` and run it again. It fails immediately, the message names the variable, and no request leaves.
8. Read the terminal output of step 6: no line contains the phrase.

---

## Notes

**The prototype's component is the source of truth for the drawing**, coordinates included. What changed here is names, tokens, and where the reasoning lives.

**The casting, so it is not repeated.** Three of Mia's sentences, four voices in a row, on 2026-09-18 against `eu-west`. Two filters before pressing play: no voice named after anyone in the household, and none described as "warm", "cheerful" or "upbeat", which is the register that turns Mia into a sales assistant. The streaming pick was `cartesia/sonic:3.5`, the fastest Spanish model served from an EU region at 109 ms, and it is WebSocket only. For a clip over HTTP the pick was `deepgram/aura:2` with `aura-2-silvia-es`, chosen by pace: the same sentence in 2.5 seconds where another voice took 3.6. A model that was considered and dropped: `fish`, which speaks Spanish but is served from no European region.

**Three things the SLNG synthesis route does that the documentation does not make obvious**, all checked in the prototype: the `model` field in the body is the voice, not the model, which goes in the URL; `encoding`, `sample_rate` and `container` are listed as optional and the Aura route rejects them with a 400; and the WAV header declares two gigabytes, which is the unknown-size marker of a streamed response, not a truncated file.

**The root layout declares `lang="en"`** while everything the family reads is Spanish. A screen reader will pronounce Mia's labels with English rules. Out of this work's scope, and worth a one-line fix soon.

**Open question for whoever builds the call screen.** The state comes from the run, never from the audio: while the clip is loading, Mia stays in `asking`, and she only becomes `speaking` when playback starts. The prototype's room already does it this way.
