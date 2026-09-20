import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { log, reason } from "../src/lib/log.ts";

/**
 * Turn the benchmark's recorded audio into the transcripts the benchmark reads:
 * step 2 of the voice measurement.
 *
 *   npm run dev                                  # the route lives in the app
 *   npm run bench:transcribe -- --dry            # print the pairing and stop
 *   npm run bench:transcribe                     # the thirty, about 8 minutes
 *   npm run bench:transcribe -- --only i07,i19   # redo a couple
 *
 * It goes through `POST /api/transcribe` instead of calling SLNG directly, and
 * that is the whole point: the number has to describe the path the family
 * actually uses — same model code, same transcription config, same polling
 * loop. A second implementation here would drift from the route without anyone
 * noticing, and the figure would quietly stop meaning anything.
 *
 * What it therefore measures is end-to-end latency through our own route, with
 * the granularity of its 1.5s polling interval. Not SLNG's processing time.
 * That distinction goes in the write-up, not in a footnote.
 */

const AUDIO_EXTENSIONS = new Set([".m4a", ".wav", ".webm", ".mp3", ".ogg", ".mp4", ".3gp"]);

/** Above the route's own ceiling of 40 polls at 1.5s, so its error wins over ours. */
const REQUEST_TIMEOUT_MS = 120_000;

/** Only for a network fault or a gateway error. A 4xx is the clip's problem, not the link's. */
const MAX_RETRIES = 2;

type Args = {
  audioDir: string;
  casesFile: string;
  outFile: string;
  runFile: string;
  baseUrl: string;
  dry: boolean;
  force: boolean;
  partial: boolean;
  only: string[];
};

function readArgs(): Args {
  const a = process.argv.slice(2);
  const val = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const only = (val("--only") ?? "").trim();

  return {
    audioDir: val("--audio") ?? "docs-internos/bench-audio",
    casesFile: val("--cases") ?? "bench/cases/intent.json",
    outFile: val("--out") ?? "bench/cases/intent-voice.json",
    runFile: val("--run") ?? "bench/transcripts/intent-voice-run.json",
    baseUrl: (val("--base-url") ?? "http://localhost:3000").replace(/\/$/, ""),
    dry: a.includes("--dry"),
    force: a.includes("--force"),
    partial: a.includes("--partial"),
    only: only ? only.split(",").map((s) => s.trim()) : [],
  };
}

type IntentCase = { id: string; text: string; expected: string };

type Entry = {
  id: string;
  audio: string;
  status: "pending" | "done" | "failed";
  transcript?: string;
  elapsedMs?: number;
  writtenChars?: number;
  spokenChars?: number;
  error?: string;
};

function fail(message: string): never {
  process.stderr.write(`\n  ${message}\n\n`);
  process.exit(1);
}

/**
 * The recorder numbers its own files and the first one is not necessarily 001 —
 * this batch starts at 025. So the offset is derived rather than written down:
 * sort by the number, pair by position.
 *
 * Every way this can go wrong is checked before a single byte reaches the
 * network, because the failure that matters is a skipped or repeated sentence.
 * That shifts everything after it, and the accuracy comes out wrong without
 * anybody noticing.
 */
function pair(audioDir: string, cases: IntentCase[]): Entry[] {
  if (!existsSync(audioDir)) fail(`No audio directory at ${path.resolve(audioDir)}`);

  const files = readdirSync(audioDir).filter((f) => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()));

  if (files.length === 0) fail(`No audio files in ${path.resolve(audioDir)}`);

  const numbered = files.map((file) => {
    const digits = file.match(/(\d+)(?!.*\d)/);
    return { file, number: digits ? Number(digits[1]) : null };
  });

  const unnumbered = numbered.filter((f) => f.number === null);
  if (unnumbered.length) {
    fail(`These files have no number in their name, so they cannot be ordered: ${unnumbered.map((f) => f.file).join(", ")}`);
  }

  const seen = new Map<number, string>();
  for (const { file, number } of numbered) {
    const previous = seen.get(number as number);
    if (previous) fail(`Two files share the number ${number}: ${previous} and ${file}`);
    seen.set(number as number, file);
  }

  if (numbered.length !== cases.length) {
    fail(
      `${numbered.length} audio files against ${cases.length} cases. One sentence was skipped or recorded twice, ` +
        `and pairing by position would shift every case after it.`,
    );
  }

  // Numeric sort, not alphabetical: today they agree, but they stop agreeing
  // the day the recorder goes past 099.
  numbered.sort((x, y) => (x.number as number) - (y.number as number));

  return cases.map((c, i) => ({ id: c.id, audio: numbered[i].file, status: "pending" as const }));
}

async function transcribe(baseUrl: string, file: string): Promise<{ transcript: string; elapsedMs: number }> {
  const bytes = readFileSync(file);
  const started = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      const form = new FormData();
      form.append("audio", new Blob([bytes]), path.basename(file));

      response = await fetch(`${baseUrl}/api/transcribe`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }

    if (response.ok) {
      const body = (await response.json()) as { transcript?: string };
      return { transcript: (body.transcript ?? "").trim(), elapsedMs: Date.now() - started };
    }

    const retriable = response.status === 502 || response.status === 504;
    const detail = await response.text().catch(() => "");
    if (!retriable || attempt === MAX_RETRIES) {
      throw new Error(`the route answered ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }

  throw new Error("unreachable");
}

function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((x, y) => x - y);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
}

function save(file: string, payload: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

const args = readArgs();

if (!existsSync(args.casesFile)) fail(`No cases file at ${path.resolve(args.casesFile)}`);

const caseData = JSON.parse(readFileSync(args.casesFile, "utf8")) as {
  description: string;
  labels: string[];
  cases: IntentCase[];
};

const entries = pair(args.audioDir, caseData.cases);
const byId = new Map(caseData.cases.map((c) => [c.id, c]));

// Resume by default: whatever already has a transcript is left alone. A failure
// on the nineteenth clip then costs eleven clips, not thirty.
if (!args.force && existsSync(args.runFile)) {
  const previous = JSON.parse(readFileSync(args.runFile, "utf8")) as { entries?: Entry[] };
  for (const old of previous.entries ?? []) {
    const current = entries.find((e) => e.id === old.id);
    if (current && old.status === "done" && old.transcript?.trim()) Object.assign(current, old);
  }
}

if (args.dry) {
  process.stdout.write(`\n  ${entries.length} pairs, ${args.audioDir} → ${args.casesFile}\n\n`);
  for (const entry of entries) {
    const mark = entry.status === "done" ? "·" : " ";
    process.stdout.write(`  ${mark} ${entry.id} ← ${entry.audio}   ${byId.get(entry.id)?.text ?? ""}\n`);
  }
  process.stdout.write("\n  Nothing was sent. Drop --dry to run it.\n\n");
  process.exit(0);
}

const wanted = entries.filter((e) => {
  if (args.only.length) return args.only.includes(e.id);
  return e.status !== "done";
});

if (wanted.length === 0) {
  process.stdout.write("\n  Everything is already transcribed. --force redoes it.\n\n");
  process.exit(0);
}

log.info("bench:transcribe starting", { clips: wanted.length, total: entries.length, baseUrl: args.baseUrl });

for (const entry of wanted) {
  const file = path.join(args.audioDir, entry.audio);
  try {
    const { transcript, elapsedMs } = await transcribe(args.baseUrl, file);
    entry.status = transcript ? "done" : "failed";
    entry.transcript = transcript;
    entry.elapsedMs = elapsedMs;
    entry.writtenChars = byId.get(entry.id)?.text.length;
    entry.spokenChars = transcript.length;
    entry.error = transcript ? undefined : "the transcript came back empty";
    // The transcript itself never reaches the log: it goes in the files.
    log.info("clip transcribed", { id: entry.id, audio: entry.audio, elapsedMs, chars: transcript.length });
  } catch (error) {
    entry.status = "failed";
    entry.error = reason(error);
    log.error("clip failed", { id: entry.id, audio: entry.audio, reason: entry.error });
  }

  // Rewritten after every clip, so a Ctrl+C loses nothing but the clip in flight.
  save(args.runFile, {
    casesFile: args.casesFile,
    audioDir: args.audioDir,
    baseUrl: args.baseUrl,
    ranAt: new Date().toISOString(),
    entries,
  });
}

const done = entries.filter((e) => e.status === "done" && e.transcript?.trim());
const missing = entries.filter((e) => !(e.status === "done" && e.transcript?.trim()));
const latencies = done.map((e) => e.elapsedMs ?? 0);

save(args.runFile, {
  casesFile: args.casesFile,
  audioDir: args.audioDir,
  baseUrl: args.baseUrl,
  ranAt: new Date().toISOString(),
  totals: {
    clips: entries.length,
    transcribed: done.length,
    missing: missing.map((e) => e.id),
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
  },
  entries,
});

process.stdout.write(`\n  ${done.length} of ${entries.length} transcribed.  p50 ${percentile(latencies, 50)} ms · p95 ${percentile(latencies, 95)} ms\n`);

// The cases file is only written when it is complete. A file with 28 good
// transcripts and 2 empty ones produces a lower accuracy that looks like a
// result and is not one. --partial writes it anyway and declares the sample.
if (missing.length && !args.partial) {
  process.stderr.write(
    `\n  ${args.outFile} was NOT written: ${missing.length} clip(s) missing (${missing.map((e) => e.id).join(", ")}).\n` +
      `  Run it again to retry only those, or pass --partial to measure over ${done.length} and say so.\n\n`,
  );
  process.exit(1);
}

save(args.outFile, {
  description:
    `${caseData.description} ` +
    `THIS FILE IS THE SPOKEN VERSION: every text is what SLNG transcribed from a recording of the ` +
    `sentence, through POST /api/transcribe, the same path the app uses. n = ${done.length} of ${entries.length}.`,
  labels: caseData.labels,
  cases: done.map((e) => ({
    id: e.id,
    text: e.transcript,
    expected: byId.get(e.id)?.expected,
    audio: e.audio,
  })),
});

process.stdout.write(`  Written: ${args.outFile} (n = ${done.length})\n\n`);
