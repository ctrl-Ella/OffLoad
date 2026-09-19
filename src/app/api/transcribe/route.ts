import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// The first server route in the project. It exists for one reason only:
// `SLNG_API_KEY` can't reach the browser. Everything else about this
// request — the audio, the transcription config — could in principle
// travel straight from the listening screen to SLNG, but the key can't,
// so the whole call goes through here instead.
//
// This goes through SLNG's batch API (`api.batch.slng.ai`), not the
// per-provider STT gateway (`<region>.api.slng.ai/v1/stt/...`) the project
// tried first. The gateway's plain `deepgram/nova:3` model only actually
// transcribes English — `language=es` is accepted and silently ignored,
// confirmed against four different Spanish clips, three of them empty at
// `confidence: 0.0` despite correct duration and channel counts. Its
// dedicated Spanish and multilingual deployments
// (`slng/deepgram/nova:3-es`, `-multi`) exist in the catalog but return
// `503 No deployments found` in every region. The batch API's
// `slng/speechmatics/batch:15.0.0` model is the one that actually
// transcribes Spanish (see `.claude/skills/consultar-docs-sponsors/SKILL.md`
// for the full trail).

const BATCH_API_BASE = "https://api.batch.slng.ai/v1/batch/jobs";
const MODEL_CODE = "slng/speechmatics/batch:15.0.0";

// The batch API is asynchronous: submitting a job returns a `job_id`
// immediately, and the transcript only exists once its status is `DONE`.
// A 5-second clip took ~15 seconds end to end when this was measured against
// the real API (2026-09-19) — roughly 3x real time — so a person's whole
// recording can take the better part of a minute. `MAX_POLL_ATTEMPTS` at
// `POLL_INTERVAL_MS` covers that with headroom before giving up.
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 40;

type BatchJob = {
  status: "QUEUED" | "IN_PROGRESS" | "DECODING" | "POST_PROCESSING" | "DONE" | "FAILED";
  error_message?: string | null;
};

type BatchJobFiles = {
  outputs: { format: "json" | "txt" | "srt"; download_url: string }[];
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  // Same criterion the project already follows with Nebius: no default
  // that would mask a missing key. If this isn't set, the route fails loud
  // and says exactly what's missing, instead of forwarding a request that
  // SLNG will reject for a reason nobody can see from here.
  const apiKey = process.env.SLNG_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing environment variable SLNG_API_KEY." },
      { status: 500 },
    );
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request isn't 'multipart/form-data'." },
      { status: 400 },
    );
  }

  const audio = incoming.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing 'audio' field in the request." },
      { status: 400 },
    );
  }

  const audioBuffer = Buffer.from(await audio.arrayBuffer());

  let submission: Response;
  try {
    submission = await fetch(BATCH_API_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_base64: audioBuffer.toString("base64"),
        input_filename: "recording.webm",
        model_code: MODEL_CODE,
        // `language` stays fixed regardless of the interface's own
        // language: the person talks to Mia in Spanish, because that's
        // what the support network — starting with grandmother Rosa —
        // speaks. Only the on-screen text is in English.
        //
        // No `enable_entities`, no `output_locale`: those rewrite numbers,
        // dates and addresses before the workflow gets to decide anything,
        // and here the workflow decides, not the transcription (see
        // CLAUDE.md, "La tesis técnica").
        transcription_config: { language: "es", operating_point: "enhanced" },
      }),
    });
  } catch (error) {
    logger.error("Failed to reach SLNG batch API", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to reach SLNG." },
      { status: 502 },
    );
  }

  if (!submission.ok) {
    const body = await submission.text();
    logger.error("SLNG batch API rejected the job", {
      status: submission.status,
      body,
    });
    return NextResponse.json(
      { error: `SLNG responded with status ${submission.status}.` },
      { status: 502 },
    );
  }

  const { job_id: jobId } = (await submission.json()) as { job_id: string };

  let job: BatchJob | null = null;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    const statusResponse = await fetch(`${BATCH_API_BASE}/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusResponse.ok) continue;

    job = (await statusResponse.json()) as BatchJob;
    if (job.status === "DONE" || job.status === "FAILED") break;
  }

  if (!job || (job.status !== "DONE" && job.status !== "FAILED")) {
    logger.error("SLNG batch job didn't finish in time", { jobId });
    return NextResponse.json(
      { error: "Transcription timed out." },
      { status: 504 },
    );
  }

  if (job.status === "FAILED") {
    logger.error("SLNG batch job failed", {
      jobId,
      errorMessage: job.error_message,
    });
    return NextResponse.json(
      { error: job.error_message ?? "Transcription failed." },
      { status: 502 },
    );
  }

  const filesResponse = await fetch(`${BATCH_API_BASE}/${jobId}/files`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!filesResponse.ok) {
    logger.error("Failed to list SLNG batch job files", {
      jobId,
      status: filesResponse.status,
    });
    return NextResponse.json(
      { error: "Failed to retrieve the transcription result." },
      { status: 502 },
    );
  }

  const files = (await filesResponse.json()) as BatchJobFiles;
  const textOutput = files.outputs.find((output) => output.format === "txt");
  if (!textOutput) {
    logger.error("SLNG batch job has no text output", { jobId });
    return NextResponse.json(
      { error: "Transcription result has no text output." },
      { status: 502 },
    );
  }

  const transcriptResponse = await fetch(textOutput.download_url);
  const transcript = (await transcriptResponse.text()).trim();

  logger.info("SLNG transcription result", {
    jobId,
    audioBytes: audio.size,
    transcriptLength: transcript.length,
  });

  return NextResponse.json({ transcript });
}
