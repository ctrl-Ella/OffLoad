import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Turns a Spanish transcript into the list the "review plan" screen shows:
// events, tasks, and conflicts. Same reason this is a server route and not
// a client call as `/api/transcribe`: `NEBIUS_API_KEY` can't reach the
// browser.
//
// The split follows the project's technical thesis (CLAUDE.md, "La tesis
// técnica"): the model only extracts — titles, event-vs-task, times, due
// labels. Whether two events collide is arithmetic over timestamps, done
// below in plain TypeScript after the model call returns. The model is
// never asked whether something conflicts.

// This is the Token Factory API, called directly with `fetch` — no Mastra
// workflow exists in this repo yet, so there's no `nebius/` prefix on the
// model id here (that prefix is a Mastra-provider convention, confirmed
// against `.claude/skills/platform-docs/SKILL.md`: "En Mastra los modelos
// llevan prefijo `nebius/`. En la API de Token Factory no lo llevan.").
//
// Two base URLs circulate in Nebius's own documentation depending on its
// age: `api.studio.nebius.ai/v1` and `api.tokenfactory.nebius.com/v1`.
// Checked against the real key on 2026-09-19: the studio hosts answer
// `401` to a key that `api.tokenfactory.nebius.com/v1/models` accepts with
// `200`, so that's the live one. Not read from the environment, unlike the
// model id below: this is a stable endpoint, not a checkpoint Nebius can
// retire without warning.
const NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1";

// No hardcoded fallback, on purpose. The project already paid for one of
// these once: `meta-llama/Llama-3.3-70B-Instruct` sat as a default in
// `modelo.ts`, Nebius retired the checkpoint without redirecting traffic,
// and the whole chat stopped answering with nothing to say why (see the
// platform-docs skill, "Nebius", entry dated 2026-09-17). Failing loud when
// the variable is missing is cheaper than a silent outage later.
const MODEL_ENV_VAR = "NEBIUS_MODEL_SMALL";

// ISO 8601 local datetime, no timezone suffix — the transcript never states
// one, and the workflow that will eventually write these to Google Calendar
// is the one that knows the household's timezone, not this route.
const ISO_LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

// What the model is asked for. Kept to what a language model actually has
// to interpret — free text into a title, a kind, and a time — and nothing
// it would have to reason about, like whether two of these collide.
const ExtractedItemSchema = z.object({
  title: z
    .string()
    .describe(
      "The event or task title, in the speaker's own Spanish words. Never translate or rephrase into English.",
    ),
  kind: z
    .enum(["event", "task"])
    .describe(
      "'event' if the speaker stated a specific clock time for it, 'task' if it has no fixed time (only, at most, a day it's due by).",
    ),
  start: z
    .string()
    .regex(ISO_LOCAL_DATETIME)
    .nullable()
    .describe(
      "ISO 8601 local datetime (YYYY-MM-DDTHH:MM:SS) the event starts. Resolve relative days ('el jueves') to the next real occurrence from the current date given in the prompt. Null for tasks, or for an event whose time wasn't stated.",
    ),
  end: z
    .string()
    .regex(ISO_LOCAL_DATETIME)
    .nullable()
    .describe(
      "ISO 8601 local datetime (YYYY-MM-DDTHH:MM:SS) the event ends, computed from a stated duration or end time. Null if it can't be derived from what was said.",
    ),
  dueLabel: z
    .string()
    .nullable()
    .describe(
      "For a task only: a short Spanish label for when it's due, in the speaker's own words (e.g. 'Antes del jueves'). Null for events.",
    ),
});

const ExtractionSchema = z.object({
  items: z.array(ExtractedItemSchema),
});

type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

export type PlanItem = {
  title: string;
  // Human-readable, e.g. "jue 18:30 – 19:30", "Antes del jueves", or a
  // conflict's own description. Built here, in TypeScript, from the
  // model's structured fields — the model is never asked to compose display
  // text, so it can't slip a translated or reworded title into it.
  detail: string;
  type: "event" | "task" | "conflict";
};

const WEEKDAY_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
});
const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatEventDetail(start: Date, end: Date): string {
  const day = WEEKDAY_TIME_FORMAT.format(start);
  const from = TIME_FORMAT.format(start);
  const to = TIME_FORMAT.format(end);
  return `${day} ${from} – ${to}`;
}

// Ranges are treated as [start, end): touching back-to-back events (one
// ending exactly when the other starts) don't count as a conflict, only
// events that actually overlap in time.
function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// The only place that decides anything: comparing timestamps pairwise. No
// call to Nebius happens here, and none should — this is exactly the
// arithmetic CLAUDE.md's "La tesis técnica" says never gets asked to a
// model.
function findConflicts(items: ExtractedItem[]): PlanItem[] {
  const events = items
    .filter((item) => item.kind === "event" && item.start && item.end)
    .map((item) => ({
      title: item.title,
      start: new Date(item.start as string),
      end: new Date(item.end as string),
    }))
    .filter((event) => !Number.isNaN(event.start.getTime()) && !Number.isNaN(event.end.getTime()));

  const conflicts: PlanItem[] = [];
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const a = events[i];
      const b = events[j];
      if (rangesOverlap(a.start, a.end, b.start, b.end)) {
        const clash = a.start > b.start ? a.start : b.start;
        conflicts.push({
          title: `Two places at ${TIME_FORMAT.format(clash)}`,
          detail: `${a.title} and ${b.title} overlap`,
          type: "conflict",
        });
      }
    }
  }
  return conflicts;
}

function toPlanItems(items: ExtractedItem[]): PlanItem[] {
  const planItems: PlanItem[] = items.map((item) => {
    if (item.kind === "event" && item.start && item.end) {
      const start = new Date(item.start);
      const end = new Date(item.end);
      return {
        title: item.title,
        detail: Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
          ? ""
          : formatEventDetail(start, end),
        type: "event",
      };
    }
    return {
      title: item.title,
      detail: item.dueLabel ?? "",
      type: "task",
    };
  });

  return [...planItems, ...findConflicts(items)];
}

export async function POST(request: Request) {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing environment variable NEBIUS_API_KEY." },
      { status: 500 },
    );
  }

  const model = process.env[MODEL_ENV_VAR];
  if (!model) {
    return NextResponse.json(
      { error: `Missing environment variable ${MODEL_ENV_VAR}.` },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request isn't valid JSON." }, { status: 400 });
  }

  const parsedBody = z.object({ transcript: z.string().min(1) }).safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Missing or empty 'transcript' field in the request." },
      { status: 400 },
    );
  }
  const { transcript } = parsedBody.data;

  // Given to the model instead of trusted implicitly from training data or
  // system-clock drift on whichever host runs this: the model has to
  // resolve "el jueves" against a date it's actually told, not one it
  // assumes.
  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const jsonSchema = z.toJSONSchema(ExtractionSchema);

  let completion: Response;
  try {
    completion = await fetch(`${NEBIUS_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              `Today is ${today}. Extract calendar events and tasks from a ` +
              "Spanish voice transcript into structured data. Resolve " +
              "relative day references ('el jueves', 'mañana') to the next " +
              "real occurrence from today. This is extraction only: never " +
              "decide whether two items conflict with each other, and never " +
              "translate the speaker's words.",
          },
          { role: "user", content: transcript },
        ],
        // The project's hard rule for every Nebius call (CLAUDE.md, "Code
        // conventions"): structured output via JSON Schema, which turns on
        // constrained decoding in vLLM. No defensive parsing and no retry
        // on bad formatting below, because the schema makes bad formatting
        // impossible rather than merely unlikely.
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "plan_extraction",
            schema: jsonSchema,
            strict: true,
          },
        },
      }),
    });
  } catch (error) {
    logger.error("Failed to reach Nebius", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to reach Nebius." }, { status: 502 });
  }

  if (!completion.ok) {
    const errorBody = await completion.text();
    logger.error("Nebius rejected the extraction request", {
      status: completion.status,
      body: errorBody,
    });
    return NextResponse.json(
      { error: `Nebius responded with status ${completion.status}.` },
      { status: 502 },
    );
  }

  const completionBody = (await completion.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = completionBody.choices[0]?.message.content ?? "";
  const extraction = ExtractionSchema.parse(JSON.parse(content));

  const items = toPlanItems(extraction.items);

  logger.info("Structured a transcript into a plan", {
    transcriptLength: transcript.length,
    itemCount: items.length,
  });

  return NextResponse.json({ items });
}
