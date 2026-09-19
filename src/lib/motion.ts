"use client";

import type { Variants } from "motion/react";
import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(notify: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

function readReducedMotionOnClient() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// The server has no way of knowing the visitor's preference: there is no
// `window`. It assumes reduced motion isn't requested, which is also what
// this hook returns on the client until React confirms the hydrated HTML
// matches the server's.
function readReducedMotionOnServer() {
  return false;
}

/**
 * Motion's `useReducedMotion` reads `matchMedia` synchronously on the first
 * render — including the render React uses to hydrate on the client. On a
 * machine with reduced motion enabled, that first render no longer matches
 * the HTML the server generated, and React flags a hydration error that
 * "cannot be patched up".
 *
 * `useSyncExternalStore` is the fix React's own documentation gives for
 * reading a browser API without that problem: the server snapshot and the
 * first client snapshot are the same (`false`), so hydration has nothing to
 * disagree on, and the real value — if it differs — arrives on the next
 * pass, already outside the comparison.
 */
export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    readReducedMotionOnClient,
    readReducedMotionOnServer,
  );
}

/**
 * Variantes de entrada respetuosas con `prefers-reduced-motion`.
 *
 * El CSS global ya neutraliza transiciones y animaciones declarativas, pero
 * Motion anima por JavaScript y no pasa por ahí: hay que preguntarselo.
 *
 * Cuando el sistema pide menos movimiento no se elimina la aparición, se
 * elimina el *desplazamiento*: el contenido sigue apareciendo, quieto. Quitar
 * la animación entera dejaría elementos con `opacity: 0` si algo falla.
 */
export function useAparicion(distancia = 12): Variants {
  const menosMovimiento = useReducedMotionSafe();

  return {
    oculto: {
      opacity: 0,
      y: menosMovimiento ? 0 : distancia,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: menosMovimiento ? 0 : 0.35,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };
}
