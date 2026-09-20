"use client";

import { Mic, Square } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ListeningOrb } from "@/components/ListeningOrb";
import { AudioWaveform } from "@/components/AudioWaveform";
import { OffloadHeader } from "@/components/OffloadHeader";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { SignedInPerson } from "@/lib/session";

/**
 * The four moments of a listening turn. `"error"` covers every way the turn
 * can fail to produce a transcript — permission denied, silence, a failed
 * request — because they all resolve the same way on screen: the message
 * explains what happened, and the mic button is ready to try again.
 */
export type ListeningStatus = "idle" | "listening" | "transcribing" | "error";

// This screen's visible text stays English on purpose. It's the one
// deliberately immersive, full-screen surface in a product that's Spanish
// everywhere else — confirmed with the person using it, not a gap to close.
const TITLE: Record<ListeningStatus, string> = {
  idle: "Tap to start",
  listening: "Listening",
  transcribing: "Sorting it out",
  error: "Tap to start",
};

// Read under the button, which processing hides entirely — see the footer
// below — so this entry is never rendered, kept only so the record stays
// total over `ListeningStatus` instead of carving out an exception type.
const CAPTION: Record<ListeningStatus, string> = {
  idle: "Tap to talk.",
  listening: "Tap when you're done.",
  transcribing: "",
  error: "Tap to talk.",
};

// Stands in for the transcript while processing. SLNG's batch API takes 15
// to 45 seconds — long enough that a bare "Transcribing…" reads as stuck.
// Naming what's actually happening gives the wait a shape.
const PROCESSING_SUBTITLE =
  "Finding the dates, the people and what needs doing.";

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
  person,
  onStart,
  onStop,
}: {
  /** Where this listening turn is right now. */
  status: ListeningStatus;
  /** What's been transcribed so far. Empty string when there's nothing yet. */
  transcript: string;
  /** What went wrong, in Mia's voice. Only read when `status` is `"error"`. */
  errorMessage?: string;
  /** Audio level per bar, from 0 to 1. */
  levels: number[];
  /** Who's signed in, for the header's account menu. `null` renders no menu. */
  person: SignedInPerson | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const isListening = status === "listening";
  const isTranscribing = status === "transcribing";
  const isError = status === "error";

  return (
    <div
      data-theme="immersive"
      className="relative flex min-h-dvh flex-col overflow-hidden bg-surface-immersive text-ink-immersive"
    >
      {/* Ambient glow, decorative. On a phone it sits close to the orb; on a
          wide screen it fills the air around the central column instead of
          leaving two empty black strips. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-immersive opacity-20 blur-3xl"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-6 sm:max-w-lg sm:pb-10">
        <OffloadHeader person={person} />

        <main
          id="content"
          className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center"
        >
          <ListeningOrb
            state={isListening ? "listening" : isTranscribing ? "processing" : "idle"}
          />

          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            {TITLE[status]}
          </h1>

          <AudioWaveform levels={levels} isActive={isListening} />

          {/* `aria-live` so the growing transcript — or the error, or the
              processing subtitle, whichever replaces it — gets announced
              without anyone using a screen reader having to go look for it.
              A `min-height` keeps the rest of the screen from jumping when
              the first words show up. */}
          <div aria-live="polite" className="min-h-[1.5em] w-full max-w-sm">
            {isError ? (
              <Notice tone="alert">{errorMessage}</Notice>
            ) : isTranscribing ? (
              <p className="text-pretty text-ink-muted-immersive">
                {PROCESSING_SUBTITLE}
              </p>
            ) : (
              <p className="text-pretty text-ink-muted-immersive">{transcript}</p>
            )}
          </div>
        </main>

        <footer className="flex flex-col items-center gap-5">
          {/* Nothing to tap while processing: SLNG already has the
              recording, and a control sitting there disabled reads as
              broken rather than busy. Hidden outright instead. */}
          {!isTranscribing && (
            <div className="flex flex-col items-center gap-2">
              <Button
                onClick={isListening ? onStop : onStart}
                label={ARIA_LABEL[status]}
                className="h-16 w-16 active:scale-95"
                style={{ borderRadius: "9999px" }}
                icon={
                  isListening ? (
                    <Square className="h-6 w-6" fill="currentColor" aria-hidden="true" />
                  ) : (
                    <Mic className="h-6 w-6" aria-hidden="true" />
                  )
                }
              />

              <p className="text-xs text-ink-muted-immersive">{CAPTION[status]}</p>
            </div>
          )}

          <hr className="w-full border-t border-border-immersive" />

          <BottomNav />
        </footer>
      </div>
    </div>
  );
}
