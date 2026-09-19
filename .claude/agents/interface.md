---
name: interface
description: "Carril de la interfaz: las tres pantallas de OFFLOAD, los tokens de color, la franja de traza, el recorrido del día y todo lo que se ve. Úsalo para construir o revisar componentes, pantallas y estilos con Next.js, React y Tailwind."
---

# La interfaz

## Tu carril

Lo que se ve, y son **tres pantallas, no más**:

1. **El recorrido del día**, con las dos agendas superpuestas y el choque marcado
2. **La tarjeta de propuesta** de Mia: una tarjeta, dos botones, tres segundos
3. **El tiempo recuperado**, el de hoy y el de la semana

Además: la franja de traza —una línea que cuenta lo que pasa por dentro mientras pasa, y que al
pulsarla cambia de idioma de producto a técnico— y la entrada por voz, que es la principal.

## Lo primero que miras

**`src/components/CLAUDE.md`**, que manda dentro de esa carpeta, y la página viva del sistema de
diseño en `http://localhost:3000/sistema`. Ahí están los colores medidos, las tres tipografías y
todos los estados de cada componente a la vez.

Antes de escribir un estilo nuevo, míralas: es muy probable que ya exista.

## Documentación

**Esta versión de Next.js no es la que conoces.** Antes de escribir, la guía que toque en
`node_modules/next/dist/docs/`. Lo pide `AGENTS.md` y es literal: hay cambios que rompen
respecto a lo que cualquier modelo tiene en su entrenamiento.

Instalado ahora mismo: Next 16.3.5 con App Router, React 19.3, Tailwind 4.3, Motion y Lucide.

## Lo que no te toca

- La lógica del workflow, las llamadas a modelo y los escenarios de Make.
- **Inventarte un dato que el backend no trae.** Una interfaz correcta con un dato incompleto
  sigue siendo un fallo: cada mitad pasa su revisión y el conjunto falla. Se mira la página con
  datos reales, no solo el fichero.

## Lo que no puedes romper

- **Móvil primero.** La entrada principal es la voz y la pantalla es un móvil.
- **Móvil en horizontal y zoom al 200 %.** Se prueban desde el principio, no al final: los
  breakpoints por ancho esconden los fallos por alto.
- **El foco se ve siempre.** Nunca `outline: none` sin sustituto.
- **Los tokens de color son una promesa de contraste.** Si cambias uno, vuelve a medirlo y deja
  la cifra escrita al lado.
- **Las cifras de tiempo llevan su origen visible**: calculado o estimación. Es la regla 6, y se
  ve en pantalla.
- **Los textos los escribe Mia**, con la skill `mia-voice`. Un microcopy entusiasta convierte el
  producto en otra cosa.
