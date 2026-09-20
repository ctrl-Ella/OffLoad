"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ListeningScreen, type ListeningStatus } from "@/components/ListeningScreen";
import { ReviewPlan, type PlanItem } from "@/components/ReviewPlan";
import type { SignedInPerson } from "@/lib/session";

/** The voice flow's three screens, end to end: `ListeningStatus` covers the
 *  first two (and the ways they can fail); `"reviewing"` is the third,
 *  rendered once `/api/structure-plan` has turned the transcript into a
 *  list of events, tasks and conflicts. */
type PageStatus = ListeningStatus | "reviewing";

const BAR_COUNT = 27;

// Fixed initial state, not random: if the first level were computed with
// Math.random() here, the HTML the server generates and the one the
// browser mounts on hydration would come out with different values, and
// React would flag it as a hydration error. The level becomes dynamic only
// once recording starts, inside the browser alone.
const IDLE_LEVELS = Array.from({ length: BAR_COUNT }, () => 0.12);

// How often the waveform reads a fresh set of levels off the analyser.
// Matches the cadence the earlier simulation used, so the bars move at the
// same pace they always have — only the numbers behind them are real now.
const LEVELS_INTERVAL_MS = 120;

// Speech rarely pushes a time-domain sample anywhere near its 128-value
// ceiling. This divisor is a visual calibration, not a measurement: it maps
// a normal speaking volume to bars that read as "moving" without every
// syllable pinning them at full height.
const LEVEL_SCALE = 40;

// Mia's copy for every way a listening turn can fail to produce a
// transcript. Each one names what happened and, in the same sentence, what
// to do now — the same shape the project's other error text uses (see the
// voz-de-mia skill). The interface is in English; what Mia actually hears
// and says through SLNG stays in Spanish, because the support network —
// starting with grandmother Rosa — speaks Spanish. This text never reaches
// SLNG, so it follows the interface's language.
const PERMISSION_DENIED_MESSAGE =
  "I don't have permission to use the microphone. Turn it on in settings and try again.";
const RECORDING_FAILED_MESSAGE = "I couldn't record that. Try again.";
const EMPTY_TRANSCRIPT_MESSAGE = "I didn't hear anything. Try again.";
const TRANSCRIPTION_FAILED_MESSAGE =
  "I couldn't transcribe what you said. Try again.";
const STRUCTURE_FAILED_MESSAGE = "I couldn't put that together. Try again.";

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

async function structurePlan(transcript: string): Promise<PlanItem[]> {
  const response = await fetch("/api/structure-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    throw new Error(`/api/structure-plan responded with status ${response.status}`);
  }

  const data: { items: PlanItem[] } = await response.json();
  return data.items;
}

/**
 * The voice flow's client half: records through `getUserMedia`/`MediaRecorder`,
 * reads audio levels off the same stream with the Web Audio API, and sends
 * the recording to `/api/transcribe` — the route that holds the SLNG key
 * this page never sees. `ListeningScreen` knows nothing about any of this;
 * it only receives `status`, `transcript`, `errorMessage` and `levels`.
 *
 * `person` arrives from `page.tsx`, a server component: only the server can
 * read the session cookie, so it's fetched there once and handed down,
 * rather than this component asking for it itself.
 */
export function OffloadFlow({ person }: { person: SignedInPerson | null }) {
  const [status, setStatus] = useState<PageStatus>("idle");
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const stopLevelMeter = useCallback(() => {
    if (levelsIntervalRef.current !== null) {
      clearInterval(levelsIntervalRef.current);
      levelsIntervalRef.current = null;
    }
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    setLevels(IDLE_LEVELS);
  }, []);

  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Belt-and-braces: if whoever is on this screen navigates away mid
  // recording, the microphone still gets released instead of staying open
  // in the background.
  useEffect(() => {
    return () => {
      stopLevelMeter();
      releaseMicrophone();
    };
  }, [stopLevelMeter, releaseMicrophone]);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    // Only reads the stream; never connects to `audioContext.destination`,
    // so it can't cause the room to hear itself back.
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const buffer = new Uint8Array(analyser.fftSize);
    const chunkSize = Math.floor(buffer.length / BAR_COUNT);

    levelsIntervalRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(buffer);

      const nextLevels = Array.from({ length: BAR_COUNT }, (_, bar) => {
        const start = bar * chunkSize;
        let sum = 0;
        for (let i = start; i < start + chunkSize; i += 1) {
          sum += Math.abs(buffer[i] - 128);
        }
        const average = sum / chunkSize;
        return Math.min(1, average / LEVEL_SCALE);
      });

      setLevels(nextLevels);
    }, LEVELS_INTERVAL_MS);
  }, []);

  const handleStart = useCallback(async () => {
    setErrorMessage("");
    setTranscript("");

    let stream: MediaStream;
    try {
      // Echo cancellation, noise suppression and auto gain are tuned for
      // voice calls, not dictation: on some hardware — especially Linux
      // audio stacks — they can suppress speech itself as if it were noise.
      // Off gives SLNG the cleanest signal to recognize.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch {
      setStatus("error");
      setErrorMessage(PERMISSION_DENIED_MESSAGE);
      return;
    }

    try {
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start();

      startLevelMeter(stream);
      setStatus("listening");
    } catch {
      releaseMicrophone();
      setStatus("error");
      setErrorMessage(RECORDING_FAILED_MESSAGE);
    }
  }, [startLevelMeter, releaseMicrophone]);

  const handleStop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    stopLevelMeter();
    setStatus("transcribing");

    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      releaseMicrophone();

      try {
        const formData = new FormData();
        formData.append("audio", blob, `recording.${extensionForMimeType(mimeType)}`);

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          setStatus("error");
          setErrorMessage(TRANSCRIPTION_FAILED_MESSAGE);
          return;
        }

        const data: { transcript?: string } = await response.json();
        const text = (data.transcript ?? "").trim();

        if (!text) {
          setStatus("error");
          setErrorMessage(EMPTY_TRANSCRIPT_MESSAGE);
          return;
        }

        setTranscript(text);

        // Status stays "transcribing" — same processing screen, same
        // "Sorting it out" copy — through this second step: from where
        // whoever's watching stands, turning the transcript into a
        // structured plan is still Mia sorting it out, not a new wait.
        try {
          const nextItems = await structurePlan(text);
          setItems(nextItems);
          setStatus("reviewing");
        } catch {
          setStatus("error");
          setErrorMessage(STRUCTURE_FAILED_MESSAGE);
        }
      } catch {
        setStatus("error");
        setErrorMessage(TRANSCRIPTION_FAILED_MESSAGE);
      }
    };

    recorder.stop();
  }, [stopLevelMeter, releaseMicrophone]);

  if (status === "reviewing") {
    return (
      <ReviewPlan items={items} person={person} />
    );
  }

  return (
    <ListeningScreen
      status={status}
      transcript={transcript}
      errorMessage={errorMessage}
      levels={levels}
      person={person}
      onStart={handleStart}
      onStop={handleStop}
    />
  );
}
