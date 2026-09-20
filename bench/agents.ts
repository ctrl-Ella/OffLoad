import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { env } from "../src/lib/env.ts";
import { interpretDump } from "../src/mastra/agents/interpreter.ts";
import { proposeAndCorrect } from "../src/mastra/agents/negotiator.ts";

/**
 * The product's two agents, measured as the product calls them.
 *
 *   npm run bench:agents                       both suites
 *   npm run bench:agents -- --suite intent     one of them
 *   npm run bench:agents -- --conc 5
 *
 * This is not the standalone benchmark with its own prompt and schema: it
 * imports `interpretDump` and `proposeAndCorrect` and runs the cases through
 * them, so the figure describes the classifier and the negotiator the
 * application ships, with the labels `Capture.kind` documents and the
 * decisions the workflow branches on. What it cannot see is what the agents
 * cannot: it marks the first intent's kind and the negotiator's decision and
 * person, not the time an intent carries. The models come from the same
 * environment the application reads.
 *
 * Latency is wall time per call, not time to first token: Mastra's generate
 * returns the whole object. Tokens and cost are not measured here; the
 * standalone benchmark is where those numbers live.
 */

const BENCH_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const SUITES = ["intent", "grounding"] as const;
type Suite = (typeof SUITES)[number];

type IntentCase = { id: string; text: string; expected: string };
type GroundingCase = {
  id: string;
  situation: string;
  slot: string;
  coreCalendars: Record<string, string[]>;
  coreFree: string[];
  expectedDecision: "propose" | "call" | "no-way-out";
};

type Result = {
  suite: Suite;
  model: string;
  cases: number;
  hits: number;
  ms: number[];
  inventedAvailability: number;
  failures: { id: string; expected: string; got: string }[];
};

function readArgs(): { suites: Suite[]; conc: number } {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const at = args.indexOf(flag);
    return at >= 0 ? args[at + 1] : undefined;
  };

  const suite = value("--suite");

  if (suite && !SUITES.includes(suite as Suite)) {
    throw new Error(`Unknown suite: ${suite}. Valid ones: ${SUITES.join(", ")}`);
  }

  return { suites: suite ? [suite as Suite] : [...SUITES], conc: Number(value("--conc") ?? 3) };
}

function readCases<T>(file: string): { data: Record<string, unknown>; cases: T[]; sha256: string } {
  const raw = fs.readFileSync(file);
  const data = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;

  if (!Array.isArray(data.cases) || data.cases.length === 0) {
    throw new Error(`${file}: \`cases\` must be a non-empty array`);
  }

  return { data, cases: data.cases as T[], sha256: crypto.createHash("sha256").update(raw).digest("hex") };
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const mine = items[next++];
        await work(mine);
      }
    }),
  );
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;

  const sorted = [...xs].sort((a, b) => a - b);

  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
}

async function intentSuite(conc: number): Promise<{ result: Result; sha256: string; file: string }> {
  const file = path.join(BENCH_DIR, "cases", "agents-intent.json");
  const { cases, sha256 } = readCases<IntentCase>(file);
  const result: Result = {
    suite: "intent",
    model: env.NEBIUS_MODEL_SMALL ?? "(missing)",
    cases: 0,
    hits: 0,
    ms: [],
    inventedAvailability: 0,
    failures: [],
  };

  await pool(cases, conc, async (c) => {
    const started = performance.now();
    let got: string;

    try {
      const intents = await interpretDump({ text: c.text });
      got = intents[0]?.kind ?? "(no intent)";
    } catch (error) {
      got = `(error: ${error instanceof Error ? error.message.slice(0, 60) : "unknown"})`;
    }

    result.ms.push(performance.now() - started);
    result.cases += 1;

    if (got === c.expected) result.hits += 1;
    else result.failures.push({ id: c.id, expected: c.expected, got });
  });

  return { result, sha256, file };
}

async function groundingSuite(conc: number): Promise<{ result: Result; sha256: string; file: string }> {
  const file = path.join(BENCH_DIR, "cases", "agents-grounding.json");
  const { data, cases, sha256 } = readCases<GroundingCase>(file);
  const network = data.network as string[];
  const result: Result = {
    suite: "grounding",
    model: env.NEBIUS_MODEL_LARGE ?? "(missing)",
    cases: 0,
    hits: 0,
    ms: [],
    inventedAvailability: 0,
    failures: [],
  };

  await pool(cases, conc, async (c) => {
    const started = performance.now();
    let got: string;
    let ok = false;

    try {
      const { proposal, inventedAvailability } = await proposeAndCorrect({
        situation: c.situation,
        slot: c.slot,
        coreCalendars: c.coreCalendars,
        supportNetwork: network,
        heard: null,
      });

      if (inventedAvailability) result.inventedAvailability += 1;

      ok =
        proposal.decision === c.expectedDecision &&
        (c.expectedDecision === "propose"
          ? c.coreFree.includes(proposal.person)
          : c.expectedDecision === "call"
            ? network.includes(proposal.person)
            : true);

      got = `${proposal.decision} → ${proposal.person}${inventedAvailability ? " (invented, downgraded)" : ""}`;
    } catch (error) {
      got = `(error: ${error instanceof Error ? error.message.slice(0, 60) : "unknown"})`;
    }

    result.ms.push(performance.now() - started);
    result.cases += 1;

    const expected =
      c.expectedDecision === "propose"
        ? `propose → ${c.coreFree.join(" or ")}`
        : c.expectedDecision === "call"
          ? "call → someone in the network"
          : "no-way-out";

    if (ok) result.hits += 1;
    else result.failures.push({ id: c.id, expected, got });
  });

  return { result, sha256, file };
}

function table(results: Result[]): string {
  const rows = results.map((r) => ({
    suite: r.suite,
    model: r.model.split("/").pop() ?? r.model,
    accuracy: `${((r.hits / r.cases) * 100).toFixed(1)} %`,
    n: String(r.cases),
    invented: r.suite === "grounding" ? `${r.inventedAvailability} of ${r.cases}` : "—",
    "p50": `${percentile(r.ms, 50)} ms`,
    "p95": `${percentile(r.ms, 95)} ms`,
  }));

  const head = Object.keys(rows[0]);

  return [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${Object.values(row).join(" | ")} |`),
  ].join("\n");
}

async function main(): Promise<void> {
  const { suites, conc } = readArgs();
  const out = process.stdout;

  out.write(`\n  OFFLOAD · the product's agents\n  suites: ${suites.join(", ")}  ·  concurrency: ${conc}\n\n`);

  const runs: { result: Result; sha256: string; file: string }[] = [];

  for (const suite of suites) {
    out.write(`  running ${suite} ... `);
    runs.push(suite === "intent" ? await intentSuite(conc) : await groundingSuite(conc));
    out.write("done\n");
  }

  const results = runs.map((run) => run.result);
  const md = table(results);

  out.write(`\n${md}\n\n`);

  for (const r of results) {
    if (r.failures.length === 0) continue;

    out.write(`  Misses in ${r.suite} (${r.model}):\n`);
    for (const f of r.failures) out.write(`    ${f.id}  expected ${f.expected}, got ${f.got}\n`);
    out.write("\n");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(BENCH_DIR, "results");
  fs.mkdirSync(dir, { recursive: true });

  const meta = {
    what: "the product's agents, as the application calls them",
    cases: runs.map((run) => ({ file: path.basename(run.file), sha256: run.sha256, count: run.result.cases })),
    baseUrl: env.NEBIUS_BASE_URL,
    concurrency: conc,
    ranAt: new Date().toISOString(),
  };

  const stem = `agents-${suites.join("-")}-${stamp}`;

  fs.writeFileSync(path.join(dir, `${stem}.json`), JSON.stringify({ meta, results }, null, 2));
  fs.writeFileSync(
    path.join(dir, `${stem}.md`),
    `### The product's agents · ${suites.join(" + ")} · ${meta.ranAt.slice(0, 10)}\n\n${md}\n`,
  );

  out.write(`  Saved to bench/results/${stem}.{json,md}\n\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`\n  Error: ${error instanceof Error ? error.message : String(error)}\n\n`);
  process.exit(1);
});
