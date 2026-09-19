"use client";

import { useReducedMotion, type Variants } from "motion/react";

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
  const menosMovimiento = useReducedMotion();

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
