/**
 * OFFLOAD · Nebius Token Factory benchmark
 * ----------------------------------------
 * One script, five numbers. It compares models and modes over real product
 * cases and reports accuracy, latency, cost and grounding.
 *
 *   npm run bench -- --suite intent
 *   npm run bench -- --suite grounding
 *   npm run bench -- --suite intent --fast
 *   npm run bench -- --suite intent --dry     (spends no tokens)
 *
 * The cases file is a separate flag from the suite, which is what makes the
 * voice measurement possible: same corrector, different input.
 *
 *   npm run bench -- --suite intent --cases cases/intent-voice.json
 *
 * Environment:
 *   NEBIUS_API_KEY    required except with --dry
 *   NEBIUS_BASE_URL   defaults to https://api.tokenfactory.nebius.com/v1
 *   BENCH_MODELS      comma-separated; --models wins over it
 */

import OpenAI from "openai";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

// `__dirname` does not exist here: the file has top-level imports, so it loads
// as an ES module whatever the package type says.
const BENCH_DIR = path.dirname(fileURLToPath(import.meta.url));

// ───────────────────────────────────────────── configuration

/**
 * Identifiers exactly as the Token Factory API wants them.
 * Careful: in Mastra these same models carry the `nebius/` prefix, which is how
 * it routes providers. Not here, because this calls Nebius directly.
 *
 * The catalogue moves and Nebius retires checkpoints without redirecting
 * traffic, so the live list gets asked for before every run:
 *   curl -H "Authorization: Bearer $NEBIUS_API_KEY" $NEBIUS_BASE_URL/models
 *
 * Three small or fast candidates for classifying, and one large one for
 * negotiating.
 */
const MODELS = [
  "Qwen/Qwen3-30B-A3B-Instruct-2507",
  "zai-org/GLM-5.3-Flash",
  "google/gemma-3-27b-it",
  "deepseek-ai/DeepSeek-V4-Pro",
];

/**
 * Dollars per million tokens, copied from the Nebius console on 2026-09-18:
 * region `eu-north1`, on-demand inference, before tax. None of them is
 * estimated — an invented number shows, and it drags the credibility of every
 * other number with it.
 *
 * **The zero on GLM-5.3-Flash is real, not a gap waiting to be filled.** The
 * model is in the catalogue and answers, but has no published rate. The report
 * prints "no price" for it, which is exactly what we know.
 *
 * Prices have an expiry date: `Valid from` in the console, and the region moves
 * from Finland to France on 2026-09-21. They get read again before any cost
 * figure is published.
 */
const PRICES: Record<string, { in: number; out: number }> = {
  "Qwen/Qwen3-30B-A3B-Instruct-2507": { in: 0.1, out: 0.3 },
  "Qwen/Qwen3-235B-A22B-Instruct-2507": { in: 0.2, out: 0.6 },
  "zai-org/GLM-5.3-Flash": { in: 0, out: 0 },
  "google/gemma-3-27b-it": { in: 0.1, out: 0.3 },
  "deepseek-ai/DeepSeek-V4-Pro": { in: 1.75, out: 3.5 },
};

const BASE_URL = process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1";
const MAX_RETRIES = 4;

/** The suites are the correctors: a prompt, a schema and a way of marking. */
const SUITES = ["intent", "grounding"] as const;
type Suite = (typeof SUITES)[number];

const DEFAULT_CASES: Record<Suite, string> = {
  intent: "cases/intent.json",
  grounding: "cases/grounding.json",
};

// ───────────────────────────────────────────── helpers

type Args = { suite: Suite; cases: string; fast: boolean; dry: boolean; conc: number; models: string[] };

function readArgs(): Args {
  const a = process.argv.slice(2);
  const val = (f: string) => {
    const i = a.indexOf(f);
    return i >= 0 ? a[i + 1] : undefined;
  };

  // The explicit flag wins over the environment variable. It used to be the
  // other way round, and a run that silently ignored `--models` was a
  // documented trap for anyone reading the table afterwards.
  const flagModels = (val("--models") ?? "").trim();
  const envModels = (process.env.BENCH_MODELS ?? "").trim();
  if (flagModels && envModels) {
    process.stderr.write("  BENCH_MODELS is set and --models was passed. Using --models.\n");
  }
  const models = flagModels || envModels;

  const suite = (val("--suite") ?? "intent") as Suite;
  if (!SUITES.includes(suite)) {
    process.stderr.write(`\n  Unknown suite: ${suite}. Valid ones: ${SUITES.join(", ")}\n\n`);
    process.exit(1);
  }

  return {
    suite,
    cases: val("--cases") ?? DEFAULT_CASES[suite],
    fast: a.includes("--fast"),
    dry: a.includes("--dry"),
    conc: Number(val("--conc") ?? 3),
    models: models ? models.split(",").map((m) => m.trim()) : MODELS,
  };
}

/**
 * `npm run bench` from the repository root lands the process in `bench/`, so a
 * path written the way it reads on disk — `bench/cases/…` — would miss. All
 * three bases get tried, because the alternative is a confusing error for
 * someone who typed the path that their editor shows them.
 *
 * `results/` always resolves against this file, so the report lands in
 * `bench/results/` no matter where the run was launched from.
 */
function resolveCases(given: string): string {
  const bases = [process.cwd(), BENCH_DIR, path.resolve(BENCH_DIR, "..")];
  const tried = [...new Set(bases.map((b) => path.resolve(b, given)))];

  for (const candidate of tried) {
    if (fs.existsSync(candidate)) return candidate;
  }

  process.stderr.write(`\n  No cases file at:\n${tried.map((t) => `    ${t}`).join("\n")}\n\n`);
  process.exit(1);
}

type IntentCase = { id: string; text: string; expected: string };
type GroundingCase = {
  id: string;
  situation: string;
  window: string;
  coreSchedule: Record<string, string[]>;
  coreFree: string[];
  expectedDecision: string;
};

/**
 * Checked before the first call, and this is the check that earns its place:
 * pointing `--cases` at the wrong file used to produce thirty misses and a
 * publishable 0% that looks like a result. Failing here costs a second.
 */
function loadCases(file: string, suite: Suite): Record<string, unknown> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    process.stderr.write(`\n  ${file} is not readable JSON: ${e instanceof Error ? e.message : e}\n\n`);
    process.exit(1);
  }

  const problems: string[] = [];
  const cases = data.cases;
  if (!Array.isArray(cases) || cases.length === 0) problems.push("`cases` must be a non-empty array");

  if (Array.isArray(cases) && cases.length > 0) {
    if (suite === "intent") {
      if (!Array.isArray(data.labels) || data.labels.length === 0) problems.push("`labels` must be a non-empty array");
      const bad = (cases as IntentCase[]).find((c) => !c?.id || typeof c?.text !== "string" || !c?.expected);
      if (bad) problems.push(`every case needs id, text and expected — first offender: ${JSON.stringify(bad).slice(0, 120)}`);
      const empty = (cases as IntentCase[]).filter((c) => c.text?.trim() === "");
      if (empty.length) problems.push(`${empty.length} case(s) have an empty text: ${empty.map((c) => c.id).join(", ")}`);
    } else {
      if (!Array.isArray(data.core)) problems.push("`core` must be an array");
      if (!Array.isArray(data.network)) problems.push("`network` must be an array");
      const bad = (cases as GroundingCase[]).find((c) => !c?.id || !c?.situation || !c?.expectedDecision);
      if (bad) problems.push(`every case needs id, situation and expectedDecision — first offender: ${JSON.stringify(bad).slice(0, 120)}`);
    }
  }

  if (problems.length) {
    process.stderr.write(`\n  ${file} does not look like a '${suite}' cases file:\n`);
    for (const p of problems) process.stderr.write(`    - ${p}\n`);
    process.stderr.write("\n");
    process.exit(1);
  }

  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const o = [...xs].sort((x, y) => x - y);
  const i = Math.min(o.length - 1, Math.floor((p / 100) * o.length));
  return Math.round(o[i]);
}

/**
 * The symbol is inside on purpose: Nebius rates are in dollars and this
 * function used to be called `eur` and print "cents". A cost figure with the
 * wrong currency is one of the few things a jury corrects out loud.
 */
function dollars(n: number): string {
  if (!n) return "no price";
  return n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`;
}

async function pool<T, R>(xs: T[], n: number, f: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, xs.length) }, async () => {
      while (i < xs.length) {
        const j = i++;
        out[j] = await f(xs[j], j);
      }
    })
  );
  return out;
}

// ───────────────────────────────────────────── client

type Reply = {
  text: string;
  ttft: number;
  ms: number;
  tokensIn: number;
  tokensOut: number;
  quota?: string;
};

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.NEBIUS_API_KEY;
    if (!apiKey) throw new Error("NEBIUS_API_KEY is missing. To try without spending tokens: --dry");
    client = new OpenAI({ apiKey, baseURL: BASE_URL });
  }
  return client;
}

/**
 * A simulated reply, to see the shape of the report without calling the API.
 * `good` is what a model that gets it right would return; `bad`, what one that
 * misses would. Picked at random with a 12% error rate so the sample report
 * does not come out perfect every time.
 */
async function dryCall(good: Record<string, unknown>, bad: Record<string, unknown>): Promise<Reply> {
  await sleep(5 + Math.random() * 25);
  const payload = Math.random() > 0.12 ? good : bad;
  return {
    text: JSON.stringify({ ...payload, motivo: "simulado" }),
    ttft: 120 + Math.random() * 380,
    ms: 400 + Math.random() * 900,
    tokensIn: 300 + Math.floor(Math.random() * 200),
    tokensOut: 12 + Math.floor(Math.random() * 20),
  };
}

async function call(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  schema: Record<string, unknown>,
  schemaName: string
): Promise<Reply> {
  const c = getClient();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const t0 = performance.now();
    let ttft = 0;
    let text = "";
    let tokensIn = 0;
    let tokensOut = 0;
    let quota: string | undefined;

    try {
      const { data: stream, response } = await c.chat.completions
        .create({
          model,
          messages,
          temperature: 0,
          stream: true,
          stream_options: { include_usage: true },
          response_format: {
            type: "json_schema",
            json_schema: { name: schemaName, strict: true, schema },
          },
        } as never)
        .withResponse();

      // Nebius quota headers: reliability made visible.
      const windowUsage = response.headers.get("x-ratelimit-dynamic-period-usage-tokens");
      const over = response.headers.get("x-ratelimit-over-limit");
      if (windowUsage) quota = `${windowUsage}%${over === "yes" ? " (exceeded)" : ""}`;

      for await (const chunk of stream as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          if (!ttft) ttft = performance.now() - t0;
          text += delta;
        }
        if (chunk.usage) {
          tokensIn = chunk.usage.prompt_tokens ?? 0;
          tokensOut = chunk.usage.completion_tokens ?? 0;
        }
      }

      return { text, ttft: Math.round(ttft), ms: Math.round(performance.now() - t0), tokensIn, tokensOut, quota };
    } catch (e: unknown) {
      const err = e as { status?: number; headers?: Record<string, string> };
      const expected = err.status === 429 || (err.status ?? 0) >= 500;
      if (!expected || attempt === MAX_RETRIES) throw e;

      // Nebius's documentation is explicit: honour Retry-After before retrying blind.
      const retryAfter = Number(err.headers?.["retry-after"] ?? 0);
      const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(60000, 2 ** attempt * 1000 + Math.random() * 500);
      process.stderr.write(`  ${err.status} on ${model}, waiting ${Math.round(wait)} ms\n`);
      await sleep(wait);
    }
  }
  throw new Error("unreachable");
}

// ───────────────────────────────────────────── suites

type Result = {
  model: string;
  mode: string;
  cases: number;
  hits: number;
  ttft: number[];
  ms: number[];
  tokensIn: number;
  tokensOut: number;
  inventedAvailability: number;
  lastQuota?: string;
  failures: { id: string; expected: string; got: string }[];
};

function empty(model: string, mode: string): Result {
  return { model, mode, cases: 0, hits: 0, ttft: [], ms: [], tokensIn: 0, tokensOut: 0, inventedAvailability: 0, failures: [] };
}

function accumulate(r: Result, reply: Reply, ok: boolean, id: string, expected: string, got: string) {
  r.cases++;
  if (ok) r.hits++;
  else r.failures.push({ id, expected, got });
  if (reply.ttft) r.ttft.push(reply.ttft);
  r.ms.push(reply.ms);
  r.tokensIn += reply.tokensIn;
  r.tokensOut += reply.tokensOut;
  if (reply.quota) r.lastQuota = reply.quota;
}

// The prompt stays in Spanish: it speaks to a Spanish family, and translating
// it would change what is being measured.
const INTENT_SYSTEM = `Eres el clasificador de OFFLOAD. Recibes una frase dictada en voz alta por una persona de la familia, transcrita tal cual, con muletillas y autocorrecciones.
Devuelves únicamente el tipo de intención.

parada: algo con hora concreta que ocupa a alguien.
recordatorio: algo que hay que recordar pero sin hora fija todavía.
nota: información que hay que guardar, sin hora ni urgencia.
delegar: pedirle a otra persona que se encargue de algo.
mover: cambiar la hora de algo que ya existía.
consulta: preguntar por la agenda, por huecos o por lo pendiente.
compra: añadir algo a la lista de la compra.

Si la frase se corrige a sí misma, vale la última versión.`;

async function intentSuite(a: Args, data: Record<string, unknown>, model: string, mode: string): Promise<Result> {
  const labels = data.labels as string[];
  const cases = data.cases as IntentCase[];
  const r = empty(model, mode);
  const schema = {
    type: "object",
    properties: { tipo: { type: "string", enum: labels } },
    required: ["tipo"],
    additionalProperties: false,
  };

  await pool(cases, a.conc, async (c) => {
    const others = labels.filter((e) => e !== c.expected);
    const reply = a.dry
      ? await dryCall({ tipo: c.expected }, { tipo: others[Math.floor(Math.random() * others.length)] })
      : await call(
          model,
          [
            { role: "system", content: INTENT_SYSTEM },
            { role: "user", content: c.text },
          ],
          schema,
          "intencion"
        );
    let kind = "";
    try {
      kind = JSON.parse(reply.text).tipo ?? "";
    } catch {
      kind = "(invalid json)";
    }
    accumulate(r, reply, kind === c.expected, c.id, c.expected, kind);
  });

  return r;
}

const GROUNDING_SYSTEM = `Eres Mia, de OFFLOAD. Ayudas a una familia a cubrir una parada que se ha quedado sin nadie.

Hay dos círculos de personas y la diferencia es lo único que importa aquí.

NÚCLEO: han conectado su calendario, así que ves sus agendas y sabes si están libres.
RED DE APOYO: solo tienes su nombre y su teléfono. No ves nada suyo y no puedes saber si están libres.

Decides una de estas tres cosas:
- "proponer": alguien del núcleo está libre en toda la franja. Pon su nombre en persona.
- "llamar": en el núcleo no puede nadie, así que hay que llamar a alguien de la red para preguntárselo. Pon en persona a quién llamarías.
- "sin_salida": no hay nadie a quien recurrir.

Regla que no se rompe nunca: de la red de apoyo NO puedes afirmar disponibilidad. Si eliges a alguien de la red, la decisión es "llamar", jamás "proponer". Inventarte que alguien de la red está libre es el peor error posible.
Y "sin nada apuntado" en el núcleo significa libre, no significa desconocido.`;

async function groundingSuite(
  a: Args,
  data: Record<string, unknown>,
  model: string,
  mode: string,
  withSchedules: boolean
): Promise<Result> {
  const network = data.network as string[];
  const core = data.core as string[];
  const cases = data.cases as GroundingCase[];
  const r = empty(model, `${mode} · ${withSchedules ? "with schedule" : "without schedule"}`);

  const schema = {
    type: "object",
    properties: {
      decision: { type: "string", enum: ["proponer", "llamar", "sin_salida"] },
      persona: { type: "string", enum: [...core, ...network, "ninguno"] },
      motivo: { type: "string" },
    },
    required: ["decision", "persona", "motivo"],
    additionalProperties: false,
  };

  await pool(cases, a.conc, async (c) => {
    const schedule = Object.entries(c.coreSchedule)
      .map(([p, xs]) => `- ${p}: ${xs.length ? xs.join("; ") : "sin nada apuntado"}`)
      .join("\n");

    const user = [
      `Situación: ${c.situation}`,
      `Franja a cubrir: ${c.window}`,
      "",
      withSchedules
        ? `Agenda del núcleo en esa franja:\n${schedule}`
        : `Núcleo: ${core.join(", ")}. No tienes sus agendas delante.`,
      "",
      `Red de apoyo (solo nombre y teléfono): ${network.join(", ")}.`,
      "",
      "¿Qué hacemos?",
    ].join("\n");

    const good =
      c.expectedDecision === "proponer"
        ? { decision: "proponer", persona: c.coreFree[0] }
        : c.expectedDecision === "llamar"
          ? { decision: "llamar", persona: network[0] }
          : { decision: "sin_salida", persona: "ninguno" };
    // The simulated failure is the interesting one: claiming someone from the
    // network can.
    const bad = { decision: "proponer", persona: network[Math.floor(Math.random() * network.length)] };

    const reply = a.dry
      ? await dryCall(good, bad)
      : await call(
          model,
          [
            { role: "system", content: GROUNDING_SYSTEM },
            { role: "user", content: user },
          ],
          schema,
          "propuesta"
        );

    let decision = "";
    let person = "";
    try {
      const j = JSON.parse(reply.text);
      decision = j.decision ?? "";
      person = j.persona ?? "";
    } catch {
      decision = "(invalid json)";
    }

    // Invented availability: claims someone from the network can, with no way of knowing.
    const invented = decision === "proponer" && network.includes(person);

    const ok =
      !invented &&
      decision === c.expectedDecision &&
      (c.expectedDecision === "proponer"
        ? c.coreFree.includes(person)
        : c.expectedDecision === "llamar"
          ? network.includes(person)
          : true);

    if (invented) r.inventedAvailability++;

    const expected =
      c.expectedDecision === "proponer"
        ? `proponer → ${c.coreFree.join(" or ")}`
        : c.expectedDecision === "llamar"
          ? "llamar → someone in the network"
          : "sin_salida";

    accumulate(r, reply, ok, c.id, expected, `${decision} → ${person}${invented ? "  ⚠ invented availability" : ""}`);
  });

  return r;
}

// ───────────────────────────────────────────── report

function cost(r: Result): number {
  const base = r.model.replace(/-fast$/, "");
  const p = PRICES[base] ?? { in: 0, out: 0 };
  return (r.tokensIn / 1e6) * p.in + (r.tokensOut / 1e6) * p.out;
}

function report(rs: Result[], suite: string, casesFile: string): string {
  const rows = rs.map((r) => {
    const c = cost(r);
    return {
      model: r.model.split("/").pop() ?? r.model,
      mode: r.mode,
      accuracy: `${((r.hits / r.cases) * 100).toFixed(1)} %`,
      invented: r.inventedAvailability ? `${r.inventedAvailability} of ${r.cases}` : "0",
      "TTFT p50": `${percentile(r.ttft, 50)} ms`,
      "TTFT p95": `${percentile(r.ttft, 95)} ms`,
      "total p50": `${percentile(r.ms, 50)} ms`,
      tokens: `${r.tokensIn} / ${r.tokensOut}`,
      "total cost": dollars(c),
      "per case": dollars(c / r.cases),
    };
  });

  console.log(`\n  Suite: ${suite}  ·  cases: ${path.basename(casesFile)}\n`);
  console.table(rows);

  const missingPrice = rs.some((r) => cost(r) === 0);
  if (missingPrice) {
    console.log(
      "\n  Warning: some models have no price in PRICES. Fill it in from the Nebius\n" +
        "  console before taking any cost figure as good.\n"
    );
  }

  const quotas = rs.map((r) => r.lastQuota).filter(Boolean);
  if (quotas.length) console.log(`  Quota used in the 15-minute window: ${quotas[quotas.length - 1]}\n`);

  for (const r of rs) {
    if (!r.failures.length) continue;
    console.log(`  Misses from ${r.model} (${r.mode}):`);
    for (const f of r.failures) console.log(`    ${f.id}  expected ${f.expected}, said ${f.got}`);
    console.log("");
  }

  // Markdown ready to paste
  const head = Object.keys(rows[0]);
  return [
    `### Benchmark · ${suite} · ${path.basename(casesFile)}`,
    "",
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((f) => `| ${Object.values(f).join(" | ")} |`),
    "",
  ].join("\n");
}

// ───────────────────────────────────────────── main

async function main() {
  const a = readArgs();
  const casesFile = resolveCases(a.cases);
  const data = loadCases(casesFile, a.suite);
  const mode = a.fast ? "fast" : "base";
  const results: Result[] = [];

  console.log(`\n  OFFLOAD · Nebius benchmark`);
  console.log(`  suite: ${a.suite}  ·  cases: ${casesFile}`);
  console.log(`  mode: ${mode}${a.dry ? "  ·  DRY RUN, no real calls" : ""}`);
  console.log(`  models: ${a.models.join(", ")}`);

  for (const m of a.models) {
    const model = a.fast ? `${m}-fast` : m;
    process.stdout.write(`  running ${model} ... `);
    if (a.suite === "grounding") {
      results.push(await groundingSuite(a, data, model, mode, true));
      results.push(await groundingSuite(a, data, model, mode, false));
    } else {
      results.push(await intentSuite(a, data, model, mode));
    }
    console.log("done");
  }

  const md = report(results, a.suite, casesFile);

  // The file name comes from the cases file, not from the suite. The voice
  // measurement runs the same suite twice over different inputs, and two runs
  // called `intent-base-…` are two runs nobody can tell apart at 2am.
  const stem = path.basename(casesFile, ".json");
  const dir = path.join(BENCH_DIR, "results");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  // `meta` is what makes the subtraction defendable: anyone can check that two
  // runs used the same model and different cases files.
  const meta = {
    suite: a.suite,
    casesFile,
    casesSha256: crypto.createHash("sha256").update(fs.readFileSync(casesFile)).digest("hex"),
    caseCount: (data.cases as unknown[]).length,
    models: a.models,
    mode,
    dry: a.dry,
    concurrency: a.conc,
    baseUrl: BASE_URL,
    ranAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(dir, `${stem}-${mode}-${stamp}.json`), JSON.stringify({ meta, results }, null, 2));
  fs.writeFileSync(path.join(dir, `${stem}-${mode}-${stamp}.md`), md);
  console.log(`  Saved to results/${stem}-${mode}-${stamp}.{json,md}\n`);
}

main().catch((e) => {
  console.error("\n  Error:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
