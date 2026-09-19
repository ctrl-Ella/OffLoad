"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotionSafe } from "@/lib/motion";

/** The orb's four moments: waiting, actively picking up speech, working on
 *  what was said, and — once the transcript comes back structured — done.
 *  Each has its own decoration around the sphere: nothing while idle,
 *  pulsing rings while listening, three dots orbiting while processing, a
 *  checkmark badge once it's sorted. Never more than one at once. */
export type OrbState = "idle" | "listening" | "processing" | "success";

// Roughly even spacing around the circle — top, lower-right, lower-left —
// placed as CSS offsets rather than trigonometry so they scale with the
// container at both breakpoints without any JavaScript measuring it.
const DOT_POSITIONS = [
  "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
  "top-[75%] right-0 translate-x-1/2 -translate-y-1/2",
  "top-[75%] left-0 -translate-x-1/2 -translate-y-1/2",
];

/**
 * The central orb on the listening screen: the indicator that Mia is
 * active and waiting for what's said, or working on it.
 *
 * The pulse and the orbit are looping animations, not entrance ones, so
 * neither uses `useAparicion` (meant for appearing once). Both ask
 * `useReducedMotionSafe` — not Motion's plain `useReducedMotion`, which on a
 * machine with reduced motion enabled already differs on the client's first
 * render and breaks hydration — and with reduced motion neither the rings
 * nor the dots move: the rings hold a fixed opacity, the dots sit still at
 * their three positions instead of orbiting.
 */
export function ListeningOrb({ state }: { state: OrbState }) {
  const prefersReducedMotion = useReducedMotionSafe();
  const isListening = state === "listening";
  const isProcessing = state === "processing";
  const isSuccess = state === "success";

  return (
    <div className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
      {[0, 1].map((ring) => (
        <motion.span
          key={ring}
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-accent-immersive"
          initial={false}
          animate={
            !isListening
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
        className="absolute inset-0"
        initial={false}
        animate={
          !isProcessing
            ? { opacity: 0 }
            : prefersReducedMotion
              ? { opacity: 1, rotate: 0 }
              : { opacity: 1, rotate: 360 }
        }
        transition={
          !isProcessing || prefersReducedMotion
            ? { duration: 0 }
            : { duration: 2.4, repeat: Infinity, ease: "linear" }
        }
      >
        {DOT_POSITIONS.map((position) => (
          <span
            key={position}
            className={`absolute h-2.5 w-2.5 rounded-full bg-accent-immersive ${position}`}
          />
        ))}
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="h-32 w-32 rounded-full sm:h-36 sm:w-36"
        style={{
          // No hue invented for the bubble effect: the light centre and the
          // dark rim are the same two tokens the rest of the screen already
          // uses for the teal brand colour.
          background:
            "radial-gradient(circle at 32% 28%, var(--color-accent-immersive) 0%, var(--color-accent-strong) 100%)",
        }}
        initial={false}
        animate={
          !isListening || prefersReducedMotion
            ? { scale: 1, opacity: 1 }
            : { scale: [1, 1.05, 1] }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* The checkmark sits on its own flat badge rather than directly on
          the gradient: --color-surface-immersive under --color-accent-immersive
          is the pair already measured at 11.86:1 elsewhere in this file, so
          reusing it here needs no new contrast figure. Landing the icon
          straight on the gradient would put it over --color-accent-strong
          at the sphere's rim, measured elsewhere at 2.73:1 against this
          surface — too close to failing to risk. */}
      {isSuccess && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-immersive sm:h-16 sm:w-16">
            <Check className="h-7 w-7 text-accent-immersive sm:h-8 sm:w-8" />
          </div>
        </div>
      )}
    </div>
  );
}
