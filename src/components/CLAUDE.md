# src/components

Esta carpeta manda sobre sí misma: antes de escribir un componente nuevo, se mira aquí y en
`http://localhost:3000/sistema` (la página viva del sistema de diseño, con los colores medidos,
las tres tipografías y todos los estados de cada componente a la vez). Todavía no existe: la crea
quien construya la primera pantalla que necesite enseñar esos estados juntos.

## Qué vive aquí

Piezas de interfaz reutilizables entre las tres pantallas del carril `interfaz` (el recorrido del
día, la tarjeta de propuesta, el tiempo recuperado), más la franja de traza y la entrada por voz.
Una pantalla completa vive en `src/app/<ruta>/page.tsx` y compone los componentes de aquí; no al
revés.

## Reglas del carril, aplicadas a esta carpeta

- **Nada de datos inventados.** Un componente recibe lo que le pasan por props. Si el dato real
  puede faltar, el componente sabe pintar ese hueco — vacío, o con su estado de carga— sin
  simular un valor como si fuera real. La página que compone el componente es la única que decide
  si usa datos reales o un valor de ejemplo para desarrollo, y si lo hace, lo dice en un
  comentario.
- **Ni un hexadecimal suelto.** Todo color sale de un token de `src/app/globals.css`. Si hace
  falta un color que no está, se añade el token allí, con su contraste medido al lado — nunca
  inline en el componente.
- **Cliente solo si hace falta.** `"use client"` únicamente cuando el componente usa estado,
  efectos, o un hook de Motion o de navegación. Lo puramente visual y estático no lo necesita.
- **Foco visible, siempre.** El estilo de foco global de `globals.css` no se pisa. Un botón de
  solo icono lleva `aria-label` describiendo la acción, y ese `aria-label` cambia si el estado del
  botón cambia.
- **Animación con `useReducedMotionSafe`, no con el `useReducedMotion` de Motion a secas.**
  Cualquier animación por JavaScript (Motion) se pregunta antes de moverse, y se pregunta con el
  hook de `src/lib/motion.ts`: el de Motion lee `matchMedia` de forma síncrona en el primer render
  del cliente y, en una máquina con menos movimiento activado, rompe la hidratación. La entrada
  usa `useAparicion`; un bucle continuo (un pulso, una espera) se pregunta aparte con
  `useReducedMotionSafe` y, si se pide menos movimiento, sigue indicando su estado sin
  desplazamiento — con opacidad o quieto, nunca invisible.
- **Se prueba en móvil horizontal y al 200% de zoom**, no solo en el ancho de un móvil en
  vertical. Nada de alturas fijas que puedan recortar contenido: si algo no cabe, la página hace
  scroll, no desaparece.
