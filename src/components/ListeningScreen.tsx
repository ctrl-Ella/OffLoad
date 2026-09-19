"use client";

import { ArrowLeft, Loader2, Mic, Square } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ListeningOrb } from "@/components/ListeningOrb";
import { AudioWaveform } from "@/components/AudioWaveform";

/**
 * The four moments of a listening turn. `"error"` covers every way the turn
 * can fail to produce a transcript — permission denied, silence, a failed
 * request — because they all resolve the same way on screen: the message
 * explains what happened, and the mic button is ready to try again.
 */
export type ListeningStatus = "idle" | "listening" | "transcribing" | "error";

const TITLE: Record<ListeningStatus, string> = {
  idle: "Tap to start",
  listening: "Listening",
  transcribing: "Transcribing…",
  error: "Tap to start",
};

const CAPTION: Record<ListeningStatus, string> = {
  idle: "Tap to talk.",
  listening: "Tap when you're done.",
  transcribing: "One moment.",
  error: "Tap to talk.",
};

const ARIA_LABEL: Record<ListeningStatus, string> = {
  idle: "Start talking",
  listening: "Stop listening",
  transcribing: "Transcribing",
  error: "Start talking",
};

/**
 * The voice listening screen: OFFLOAD's primary entry point.
 *
 * Presentational and stateless. Whoever uses it decides where `transcript`,
 * `levels` and `status` come from — today, `src/app/offload/page.tsx`, which
 * records through `getUserMedia`/`MediaRecorder`, reads real audio levels
 * with the Web Audio API, and sends the recording to SLNG through
 * `/api/transcribe`.
 */
export function ListeningScreen({
  status,
  transcript,
  errorMessage,
  levels,
  onStart,
  onStop,
  onBack,
}: {
  /** Where this listening turn is right now. */
  status: ListeningStatus;
  /** What's been transcribed so far. Empty string when there's nothing yet. */
  transcript: string;
  /** What went wrong, in Mia's voice. Only read when `status` is `"error"`. */
  errorMessage?: string;
  /** Audio level per bar, from 0 to 1. */
  levels: number[];
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
}) {
  const isListening = status === "listening";
  const isTranscribing = status === "transcribing";
  const isError = status === "error";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-fondo-inmersivo)] text-[var(--color-texto-inmersivo)]">
      {/* Ambient glow, decorative. On a phone it sits close to the orb; on a
          wide screen it fills the air around the central column instead of
          leaving two empty black strips. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--color-turquesa-inmersivo)" }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-6 sm:max-w-lg sm:pb-10">
        <header className="pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-superficie-inmersiva)" }}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <main
          id="contenido"
          className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center"
        >
          <ListeningOrb isActive={isListening} />

          <h1 className="text-2xl font-semibold sm:text-3xl">
            {TITLE[status]}
          </h1>

          <AudioWaveform levels={levels} isActive={isListening} />

          {/* `aria-live` so the growing transcript — or the error that
              replaces it — gets announced without anyone using a screen
              reader having to go look for it. A `min-height` keeps the rest
              of the screen from jumping when the first words show up. */}
          <p
            aria-live="polite"
            className="min-h-[1.5em] max-w-sm text-pretty"
            style={{
              color: isError
                ? "var(--color-aviso-inmersivo)"
                : "var(--color-texto-suave-inmersivo)",
            }}
          >
            {isError ? errorMessage : transcript}
          </p>
        </main>

        <footer className="flex flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={isListening ? onStop : onStart}
              disabled={isTranscribing}
              aria-label={ARIA_LABEL[status]}
              aria-busy={isTranscribing}
              className="flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95 disabled:active:scale-100"
              style={{
                backgroundColor: "var(--color-turquesa-inmersivo)",
                opacity: isTranscribing ? 0.7 : 1,
              }}
            >
              {isListening ? (
                <Square
                  className="h-6 w-6"
                  style={{ color: "var(--color-fondo-inmersivo)" }}
                  fill="currentColor"
                  aria-hidden="true"
                />
              ) : isTranscribing ? (
                <Loader2
                  className="h-6 w-6 animate-spin"
                  style={{ color: "var(--color-fondo-inmersivo)" }}
                  aria-hidden="true"
                />
              ) : (
                <Mic
                  className="h-6 w-6"
                  style={{ color: "var(--color-fondo-inmersivo)" }}
                  aria-hidden="true"
                />
              )}
            </button>

            <p className="text-xs text-[var(--color-texto-suave-inmersivo)]">
              {CAPTION[status]}
            </p>
          </div>

          <hr
            className="w-full border-t"
            style={{ borderColor: "var(--color-superficie-inmersiva)" }}
          />

          <BottomNav />
        </footer>
      </div>
    </div>
  );
}
