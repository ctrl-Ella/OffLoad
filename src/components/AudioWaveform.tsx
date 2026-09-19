"use client";

import { motion } from "motion/react";
import { useReducedMotionSafe } from "@/lib/motion";

/**
 * Audio level visualization while Mia is listening.
 *
 * `levels` are values from 0 to 1, one per bar. Whoever composes this
 * component decides where they come from: in development, a local example
 * value; the real, live audio level is the voice integration's lane (SLNG)
 * and arrives here as a prop — it isn't computed inside.
 *
 * With `prefers-reduced-motion`, the bars stay still at their height: they
 * keep showing the level, just without the continuous jump.
 */
export function AudioWaveform({
  levels,
  isActive,
}: {
  levels: number[];
  isActive: boolean;
}) {
  const prefersReducedMotion = useReducedMotionSafe();

  return (
    <div
      className="flex h-12 w-full items-center justify-center gap-[3px]"
      role="img"
      aria-label={
        isActive ? "Nivel de audio mientras hablas" : "Nivel de audio en pausa"
      }
    >
      {levels.map((level, index) => {
        const minHeight = 4;
        const maxHeight = 48;
        const height = Math.max(
          minHeight,
          Math.round(minHeight + level * (maxHeight - minHeight)),
        );

        return (
          <motion.span
            key={index}
            aria-hidden="true"
            className="w-[3px] shrink-0 rounded-full bg-[var(--color-turquesa-inmersivo)]"
            initial={false}
            animate={{
              height,
              opacity: isActive ? 1 : 0.4,
            }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.12,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}
