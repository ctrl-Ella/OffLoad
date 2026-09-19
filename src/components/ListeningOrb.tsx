"use client";

import { motion } from "motion/react";
import { useReducedMotionSafe } from "@/lib/motion";

/**
 * The central orb on the listening screen: the indicator that Mia is
 * active and waiting for what's said.
 *
 * The pulse is a looping animation, not an entrance one, so it doesn't use
 * `useAparicion` (meant for appearing once). It asks `useReducedMotionSafe`
 * — not Motion's plain `useReducedMotion`, which on a machine with reduced
 * motion enabled already differs on the client's first render and breaks
 * hydration — and with reduced motion the orb stays still: only the rings
 * change opacity, without moving or scaling.
 */
export function ListeningOrb({ isActive }: { isActive: boolean }) {
  const prefersReducedMotion = useReducedMotionSafe();

  return (
    <div className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
      {[0, 1].map((ring) => (
        <motion.span
          key={ring}
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-[var(--color-turquesa-inmersivo)]"
          initial={false}
          animate={
            !isActive
              ? { opacity: 0, scale: 1 }
              : prefersReducedMotion
                ? { opacity: 0.25, scale: 1 }
                : {
                    opacity: [0.35, 0, 0.35],
                    scale: [1, 1.35, 1],
                  }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: ring * 0.9,
                }
          }
        />
      ))}

      <motion.div
        aria-hidden="true"
        className="h-32 w-32 rounded-full sm:h-36 sm:w-36"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, #8ff2ea 0%, var(--color-turquesa-inmersivo) 45%, #0a4a47 100%)",
        }}
        initial={false}
        animate={
          !isActive || prefersReducedMotion
            ? { scale: 1, opacity: 1 }
            : { scale: [1, 1.05, 1] }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
        }
      />
    </div>
  );
}
