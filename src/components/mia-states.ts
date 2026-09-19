/**
 * Mia's contract, in a module with no "use client": a server component that
 * imports a value through the client boundary gets a reference, not the
 * value. The drawing itself is in mia.tsx.
 *
 * Every state maps to something the system knows — a transcription running, a
 * tool running, a proposal waiting — so none of them claims what is not true.
 * The reasoning is in docs/specs/0002-mia-states-and-voice.md.
 */
export type MiaState = "quiet" | "listening" | "preparing" | "asking" | "speaking";

/** What is shown on screen. Spanish, because the family reads it. */
export const MIA_LABELS: Record<MiaState, string> = {
  quiet: "Callada",
  listening: "Escuchando",
  preparing: "Preparando",
  asking: "Pide la palabra",
  speaking: "Hablando",
};

/** The order they happen in: one full turn. */
export const MIA_STATE_ORDER: MiaState[] = [
  "quiet",
  "listening",
  "preparing",
  "asking",
  "speaking",
];

/**
 * The background that makes her visible on the light page without a frame.
 * It fades on its own colour, not to `transparent`: that one is black with
 * zero alpha and drags the gradient through a band of dirty grey.
 */
export const MIA_SKY = `radial-gradient(50% 46% at 50% 50%,
  var(--mia-sky) 0%,
  color-mix(in srgb, var(--mia-sky) 60%, transparent) 54%,
  color-mix(in srgb, var(--mia-sky) 0%, transparent) 100%)`;
