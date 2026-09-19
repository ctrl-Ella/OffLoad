---
name: accesibilidad
description: "Repaso de accesibilidad página a página hasta el mínimo legal (EN 301 549, que remite a WCAG 2.1 AA). Úsalo para auditar una pantalla concreta, arreglar lo que encuentre y dejar por escrito lo que no se ha podido comprobar sin un navegador o sin un lector de pantalla real."
---

# Accesibilidad · el mínimo legal

## El estándar de este proyecto

**EN 301 549, que remite a WCAG 2.1 nivel AA.** No AAA. Es una decisión consciente de alcance
para un fin de semana y está razonada en `docs/guias/accesibilidad.md`.

Eso significa que **no** hay que perseguir lo que ya sobrepasa el listón. Si un token de color
cumple AA de sobra, se deja y se pasa a lo siguiente.

## Cómo trabajas

Una página cada vez. Por cada una:

1. Recorres la pantalla y anotas lo que falla contra el listón de abajo
2. Arreglas lo que se arregla en el fichero
3. **Dejas escrito lo que no has podido comprobar tú**

Ese tercer punto no es opcional. **ARIA es una promesa, no una garantía**: un atributo correcto
según la especificación no asegura que un lector de pantalla lo anuncie, porque cada motor la
cumple a su manera. Lo que importa de verdad hay que oírlo, no leerlo. Cuando decidas un `role`
o un patrón ARIA, di explícitamente qué queda pendiente de verificar a mano.

Y tú no validas tu propia corrección: lo que arregles vuelve a QA para que lo compruebe en el
montaje real.

## El listón, por orden de lo que más rompe

**Lo que se comprueba siempre, porque es donde falla de verdad:**

- **Móvil primero**, y que se vea bien también en pantalla de ordenador y en pantalla grande
- **Móvil en horizontal**: gesto cotidiano que cae en el punto ciego de un `max-width`
- **Zoom al 200 %** sin que nada se corte ni se solape
- Nada de scroll horizontal en el cuerpo de la página

**Teclado y foco:**

- Todo lo interactivo se alcanza con tabulador, en un orden que sigue a la vista
- El foco se ve **siempre**. Nunca `outline: none` sin sustituto
- Nada de trampas de foco, y nada de `autofocus`

**Estructura y nombres:**

- Un solo `h1` por página y jerarquía de encabezados sin saltos
- Etiqueta real en cada control. Un `placeholder` no es una etiqueta: desaparece al escribir
- Botones de solo icono con `aria-label`; iconos decorativos con `aria-hidden`
- `alt` que dice lo que la imagen comunica, no «imagen de»
- Lo que cambia solo en pantalla se anuncia con `aria-live` en la región que toca

**Color y movimiento:**

- Contraste **4,5:1 para texto normal y 3:1 para texto grande y elementos gráficos**
- El color nunca es el único portador de información
- `prefers-reduced-motion` respetado en CSS **y** en JavaScript: Motion anima por JS y no pasa
  por la media query, hay que preguntárselo

## Lo que no te toca

- Cambiar la lógica de una pantalla o su contenido. Si un arreglo de accesibilidad obliga a
  rediseñar, lo dices y lo decide el carril `interfaz`.
- Perseguir AAA. Si algo ya cumple AA, está terminado.
- Los textos de producto: esos van con la skill `voz-de-mia`.
