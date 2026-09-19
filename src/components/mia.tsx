"use client";

import { useEffect, useId, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { MIA_LABELS, MIA_SKY, type MiaState } from "./mia-states";
import "./mia.css";

/**
 * Mia in two pieces. `MiaFigure` is the drawing alone; `Mia` adds the sky that
 * lifts her off the page and the label saying what she is doing. Neither has a
 * frame: the video tile belongs to the call. The states and their labels are
 * in mia-states.ts, which server components can import.
 */

/** The word carries the information; the colour only reinforces it. */
const LABEL_TONE: Record<MiaState, string> = {
  quiet: "text-ink-muted",
  listening: "text-ink-muted",
  preparing: "text-ink-muted",
  asking: "text-accent-strong",
  speaking: "text-accent-strong",
};

/** How hard the flame pushes. Working and speaking burn more. */
const THRUST: Record<MiaState, number> = {
  quiet: 0.55,
  listening: 0.65,
  preparing: 0.9,
  asking: 0.8,
  speaking: 1,
};

/** The paw, the same on both sides. The paws never move: see the spec. */
const PAW = "M142 144 C160 154 168 174 160 186 C152 196 136 190 130 176 Z";

const FINGERS = [
  { cx: 139, cy: 188 },
  { cx: 147, cy: 192 },
  { cx: 155, cy: 188 },
];

/** A tenth of a second apart, so the blink does not look like a clock. */
const EYES = [
  { cx: 80, delay: 0 },
  { cx: 120, delay: 0.1 },
];

/**
 * How far the gaze travels, in viewBox units. An ellipse: sideways there is
 * room, but the helmet ring sits above and the mouth below. `reach` is screen
 * pixels — the distance at which the gaze is already at its limit.
 */
const GAZE = { x: 7, y: 5, reach: 260 };

const SPRING = { stiffness: 160, damping: 20, mass: 0.6 };

/**
 * The eyes follow the pointer. Looking says nothing about the system, so it
 * can follow the mouse without breaking rule 4. Only with a real pointer: on
 * touch the listener is never attached, since following a finger leaves the
 * gaze stuck where it lifted. Motion values, so no React render per move.
 */
function useGaze(still: boolean) {
  const visorRef = useRef<SVGCircleElement>(null);
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);

  useEffect(() => {
    if (still) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const onMove = (event: PointerEvent) => {
      // The visor, not the svg: the svg's box depends on how each screen
      // places it, and the visor is exactly where the face is.
      const visor = visorRef.current?.getBoundingClientRect();
      if (!visor) return;

      const dx = event.clientX - (visor.left + visor.width / 2);
      const dy = event.clientY - (visor.top + visor.height / 2);
      const distance = Math.hypot(dx, dy);

      // Right on the eyes there is no direction, and dividing would jump.
      if (distance < 1) {
        x.set(0);
        y.set(0);
        return;
      }

      const tension = Math.min(distance / GAZE.reach, 1);
      x.set((dx / distance) * tension * GAZE.x);
      y.set((dy / distance) * tension * GAZE.y);
    };

    // When the tab loses focus the cursor is gone, and the gaze would stay
    // pinned at the edge it left through.
    const recentre = () => {
      x.set(0);
      y.set(0);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("blur", recentre);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", recentre);
    };
  }, [still, x, y]);

  return { visorRef, x, y };
}

const BARS = [80, 90, 100, 110, 120];

/** Uneven on purpose: a symmetric wave does not read as a voice. */
const HEIGHTS = [
  [8, 22, 12, 18, 8],
  [14, 30, 18, 26, 14],
  [10, 34, 22, 30, 10],
  [16, 26, 14, 22, 16],
  [8, 18, 24, 14, 8],
];

/** The sound reaching the headphones, two waves each side. */
const WAVES = [
  { d: "M17 84 Q10 94 17 104", far: false },
  { d: "M10 78 Q2 94 10 110", far: true },
  { d: "M183 84 Q190 94 183 104", far: false },
  { d: "M190 78 Q198 94 190 110", far: true },
];

const BUBBLE_DOTS = [
  { cx: 183, className: "mia-dot" },
  { cx: 193, className: "mia-dot d2" },
  { cx: 203, className: "mia-dot d3" },
];

/**
 * The drawing alone. Whoever uses it sets the size: by default it fills its
 * box and keeps its proportion.
 */
export function MiaFigure({
  state,
  className = "h-full w-full",
}: {
  state: MiaState;
  className?: string;
}) {
  // Motion animates in JavaScript and bypasses the CSS media query, so it has
  // to be asked. The CSS loops in mia.css handle themselves.
  const still = useReducedMotion() ?? false;

  const { visorRef, x, y } = useGaze(still);
  // The mouth follows at a third. Moved as much as the eyes, the whole head
  // seems to drift instead of the gaze.
  const mouthX = useTransform(x, (value) => value / 3);
  const mouthY = useTransform(y, (value) => value / 3);

  // Gradients and filters need ids, and several Mias can share a page.
  const id = useId();
  const visor = `visor-${id}`;
  const helmet = `helmet-${id}`;
  const body = `body-${id}`;
  const brand = `brand-${id}`;
  const flame = `flame-${id}`;
  const glow = `glow-${id}`;
  const halo = `halo-${id}`;

  const listening = state === "listening";
  const speaking = state === "speaking";

  /** The face, worn by the four states that are not speaking. */
  const face = (
    <>
      {/* The blink scales each eye; the gaze translates the group. Separate
          elements so they do not share a transform. */}
      <motion.g style={{ x, y }}>
        {EYES.map(({ cx, delay }) => (
          <motion.circle
            key={cx}
            cx={cx}
            cy={88}
            r={8}
            fill="var(--mia-eye)"
            style={{ transformBox: "view-box", transformOrigin: `${cx}px 88px` }}
            animate={still ? { scaleY: 1 } : { scaleY: [1, 1, 0.08, 1, 1] }}
            transition={
              still
                ? undefined
                : {
                    duration: listening ? 3.6 : 5.4,
                    times: [0, 0.9, 0.935, 0.97, 1],
                    repeat: Infinity,
                    delay,
                    ease: "easeInOut",
                  }
            }
          />
        ))}
      </motion.g>

      {/* A very soft curve. A straight line with round eyes read as sadness. */}
      <motion.path
        d="M90 110 Q100 116 110 110"
        fill="none"
        stroke="var(--mia-eye)"
        strokeWidth={5}
        strokeLinecap="round"
        style={{ x: mouthX, y: mouthY }}
      />
    </>
  );

  return (
    // Twelve units taller and twenty wider than the drawing: room for the
    // bubble and the notebook, which the svg box would otherwise clip.
    <svg viewBox="0 -12 220 244" className={`mia-float ${className}`} aria-hidden="true">
      <defs>
        <radialGradient id={visor} cx="0.34" cy="0.24" r="0.78">
          <stop offset="0%" stopColor="var(--mia-visor-light)" />
          <stop offset="100%" stopColor="var(--mia-visor-dark)" />
        </radialGradient>

        <linearGradient id={helmet} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="var(--mia-shine)" />
          <stop offset="55%" stopColor="var(--mia-helmet)" />
          <stop offset="100%" stopColor="var(--mia-helmet-shade)" />
        </linearGradient>

        <linearGradient id={body} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="var(--mia-body-light)" />
          <stop offset="100%" stopColor="var(--mia-body-dark)" />
        </linearGradient>

        <linearGradient id={brand} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="var(--mia-brand-light)" />
          <stop offset="100%" stopColor="var(--mia-brand)" />
        </linearGradient>

        <linearGradient id={flame} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="var(--mia-shine)" />
          <stop offset="35%" stopColor="var(--mia-eye)" />
          <stop offset="100%" stopColor="var(--mia-eye)" stopOpacity="0.15" />
        </linearGradient>

        <filter id={glow} x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="3.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Without a declared region the browser clips the glow flat mid-flame. */}
        <filter id={halo} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Always lit — she is running even when quiet — but pushing harder or
          softer with the state. */}
      <g filter={`url(#${halo})`} opacity={THRUST[state]}>
        <path
          className="mia-flame"
          d="M89 189 C93 184 107 184 111 189 C112 203 107 217 100 232 C93 217 88 203 89 189 Z"
          fill={`url(#${flame})`}
        />
        <path
          className="mia-flame"
          d="M94 194 C96 191 104 191 106 194 C107 202 104 211 100 220 C96 211 93 202 94 194 Z"
          fill="var(--mia-flame-core)"
          opacity={0.75}
        />
      </g>

      {/* The headband goes before the ears so it passes behind them and the
          helmet. Radius 62 on a helmet of 56: enough to show, not to float. */}
      <AnimatePresence initial={false}>
        {listening && (
          <motion.path
            key="headband"
            d="M34 94 A 62 62 0 0 1 166 94"
            fill="none"
            stroke={`url(#${brand})`}
            strokeWidth={10}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            exit={{ pathLength: 0 }}
            transition={{ duration: still ? 0 : 0.32, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* Ears before the helmet, so it clips them and they seem to grow from inside. */}
      <path d="M50 70 L54 8 L102 50 Z" fill={`url(#${helmet})`} />
      <path d="M150 70 L146 8 L98 50 Z" fill={`url(#${helmet})`} />
      <path d="M62 62 L64 26 L90 50 Z" fill={`url(#${brand})`} />
      <path d="M138 62 L136 26 L110 50 Z" fill={`url(#${brand})`} />

      <path
        d="M74 136 h52 l4 40 C132 190 118 200 100 200 C82 200 68 190 70 176 Z"
        fill={`url(#${body})`}
      />
      <rect x={72} y={132} width={56} height={11} rx={5.5} fill={`url(#${helmet})`} />
      <circle cx={100} cy={168} r={15} fill={`url(#${helmet})`} />
      <circle cx={100} cy={168} r={11} fill={`url(#${brand})`} />

      <circle cx={100} cy={92} r={56} fill={`url(#${helmet})`} />
      {/* Also where `useGaze` reads the face's position: it moves with no state. */}
      <circle ref={visorRef} cx={100} cy={92} r={46} fill={`url(#${visor})`} />

      <AnimatePresence initial={false}>
        {listening && (
          <motion.g
            key="headphones"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{
              duration: still ? 0 : 0.2,
              delay: still ? 0 : 0.18,
              ease: "easeOut",
            }}
            style={{ transformBox: "view-box", transformOrigin: "100px 92px" }}
          >
            <rect x={22} y={72} width={24} height={44} rx={12} fill={`url(#${brand})`} />
            <rect x={154} y={72} width={24} height={44} rx={12} fill={`url(#${brand})`} />
            <rect x={28} y={80} width={6} height={20} rx={3} fill="var(--mia-shine)" opacity={0.35} />
            <rect x={160} y={80} width={6} height={20} rx={3} fill="var(--mia-shine)" opacity={0.35} />

            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: still ? 0 : 0.2, delay: still ? 0 : 0.45 }}
            >
              {WAVES.map(({ d, far }) => (
                <path
                  key={d}
                  className={far ? "mia-wave far" : "mia-wave"}
                  d={d}
                  fill="none"
                  stroke="var(--mia-eye)"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              ))}
            </motion.g>
          </motion.g>
        )}
      </AnimatePresence>

      {/* The visor only melts in and out of speaking, the one state without a
          face. Between the other four the face stays put. */}
      <g filter={`url(#${glow})`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.g
            key={speaking ? "voice" : "face"}
            style={{ transformBox: "view-box", transformOrigin: "100px 92px" }}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.86 }}
            transition={{ duration: still ? 0 : 0.18, ease: "easeOut" }}
          >
            {speaking
              ? BARS.map((barX, i) => (
                  <motion.rect
                    key={barX}
                    x={barX - 3}
                    width={6}
                    rx={3}
                    fill="var(--mia-eye)"
                    initial={{ height: 16, y: 84 }}
                    animate={
                      still
                        ? { height: 20, y: 82 }
                        : {
                            height: HEIGHTS[i],
                            y: HEIGHTS[i].map((h) => 92 - h / 2),
                          }
                    }
                    transition={
                      still
                        ? undefined
                        : {
                            duration: 1.1,
                            repeat: Infinity,
                            delay: i * 0.09,
                            ease: "easeInOut",
                          }
                    }
                  />
                ))
              : face}
          </motion.g>
        </AnimatePresence>
      </g>

      {/* The two speculars. Without them the visor is a dark circle. */}
      <ellipse
        cx={78}
        cy={64}
        rx={22}
        ry={13}
        fill="var(--mia-shine)"
        opacity={0.14}
        transform="rotate(-24 78 64)"
      />
      <ellipse cx={116} cy={58} rx={7} ry={4.5} fill="var(--mia-shine)" opacity={0.2} />

      {/* What she holds comes out from where the paw touches it, after a short
          delay, and leaves faster than it arrived. It goes BEFORE the paws in
          the DOM: a hand sits in front of what it holds. */}
      <AnimatePresence>
        {state === "preparing" && (
          <motion.g
            key="notebook"
            transform="rotate(-7 194 29)"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0, transition: { duration: still ? 0 : 0.14 } }}
            style={{ transformBox: "view-box", transformOrigin: "174px 52px" }}
            transition={{
              duration: still ? 0 : 0.22,
              ease: "easeOut",
              delay: still ? 0 : 0.12,
            }}
          >
            <rect
              x={174}
              y={6}
              width={40}
              height={46}
              rx={6}
              fill="var(--mia-visor-dark)"
              stroke={`url(#${helmet})`}
              strokeWidth={3}
            />
            <path d="M182 19 h24" stroke="var(--mia-eye)" strokeWidth={3} strokeLinecap="round" fill="none" />
            <path d="M182 30 h24" stroke="var(--mia-eye)" strokeWidth={3} strokeLinecap="round" fill="none" />
            <path
              className="mia-line-3"
              d="M182 41 h16"
              stroke="var(--mia-eye)"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          </motion.g>
        )}

        {state === "asking" && (
          <motion.g
            key="bubble"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0, transition: { duration: still ? 0 : 0.14 } }}
            style={{ transformBox: "view-box", transformOrigin: "152px 66px" }}
            transition={{
              duration: still ? 0 : 0.22,
              ease: "easeOut",
              delay: still ? 0 : 0.12,
            }}
          >
            {/* The tail before the box so the join is clean, and it points at
                the face: a bubble comes from whoever speaks. */}
            <path
              d="M180 34 L152 66 L194 38 Z"
              fill="var(--mia-visor-dark)"
              stroke={`url(#${helmet})`}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <rect
              x={172}
              y={0}
              width={42}
              height={36}
              rx={12}
              fill="var(--mia-visor-dark)"
              stroke={`url(#${helmet})`}
              strokeWidth={3}
            />
            {BUBBLE_DOTS.map(({ cx, className }) => (
              <circle key={cx} className={className} cx={cx} cy={18} r={4.5} fill="var(--mia-eye)" />
            ))}
          </motion.g>
        )}
      </AnimatePresence>

      {/* The left paw is the right one mirrored, so both are identical by construction. */}
      <g transform="translate(200,0) scale(-1,1)">
        <path d={PAW} fill={`url(#${helmet})`} />
        {FINGERS.map(({ cx, cy }) => (
          <circle key={cx} cx={cx} cy={cy} r={5} fill={`url(#${helmet})`} />
        ))}
      </g>
      <g>
        <path d={PAW} fill={`url(#${helmet})`} />
        {FINGERS.map(({ cx, cy }) => (
          <circle key={cx} cx={cx} cy={cy} r={5} fill={`url(#${helmet})`} />
        ))}
      </g>
    </svg>
  );
}

/** Mia with her state label, on the page's own surface. No frame. */
export function Mia({ state }: { state: MiaState }) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative w-full">
        {/* Overflows on all four sides so the sky reaches transparent OUTSIDE
            the drawing; otherwise she gets a ring of shadow on her outline. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-12%]"
          style={{ background: MIA_SKY }}
        />

        <MiaFigure state={state} className="relative h-auto w-full" />
      </div>

      <p className="text-center">
        <span aria-hidden="true" className="block text-sm font-medium text-ink">
          Mia
        </span>
        <span role="status" className={`block font-mono text-xs ${LABEL_TONE[state]}`}>
          {/* The subject first: in a call there are more tiles, and «Callada»
              alone does not say whose. */}
          <span className="sr-only">Mia: </span>
          {MIA_LABELS[state]}
        </span>
      </p>
    </div>
  );
}
