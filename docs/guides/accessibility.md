# Accesibilidad

El objetivo del proyecto es **el mínimo legal: EN 301 549, que remite a WCAG 2.1 nivel AA**.

No es un extra para el final: en el reto de Vonage, la experiencia de uso puntúa.

## Por qué AA y no AAA

El proyecto arrancó apuntando a AAA y el listón bajó a propósito. Tres motivos, y merecen estar
escritos porque la decisión se ve en los tokens de color:

- **El alcance es un fin de semana.** AAA obliga a oscurecer los tres acentos de marca hasta
  perder el tomate que identifica el producto, y a verificar patrones ARIA con lector de pantalla
  real. Eso es tiempo que le hace falta a la videollamada.
- **La QA lo revisa en continuo**, no en una pasada al final, así que lo que más rompe se detecta
  igual.
- **Los tokens que ya existen cumplen AA con margen.** Lo que aquí se pide no es un mínimo
  teórico: es lo que ya está construido.

Lo que **no** baja: nada de esto depende del nivel AA o AAA, y todo se sigue cumpliendo igual.
Foco siempre visible, teclado completo, etiquetas reales, `prefers-reduced-motion`, móvil en
horizontal y zoom al 200 %.

Un subagente, `accessibility`, repasa página a página contra este listón.

---

## Color

Los tokens están en [`src/app/globals.css`](../../src/app/globals.css) y **cada uno lleva
anotado su contraste medido**. El listón es **4,5:1 para texto normal y 3:1 para texto grande y
elementos gráficos**.

Los acentos de marca se quedan por encima de ese listón pero por debajo de 7:1, y esa es
exactamente la diferencia entre AA y AAA. El turquesa es el más justo de los tres, así que se
reserva para titulares, iconos y bordes, y no se usa para texto normal sobre fondo claro.

**Si cambias un color, vuelve a medirlo.** Un token es una promesa de contraste: si se cambia sin
comprobar, la promesa se rompe en silencio y nadie se entera hasta que alguien no puede leer la
pantalla.

Para medir: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) o las
herramientas de desarrollo del navegador, que lo muestran al inspeccionar un color.

Y el color **nunca es el único indicador**. Un campo en rojo no comunica error a quien no
distingue el rojo: hace falta también un icono o un texto.

---

## Foco

**Nunca `outline: none` sin sustituto.** Quien navega con teclado pierde la referencia de dónde
está y la página deja de ser usable.

El estilo de foco está definido una vez, globalmente, con `:focus-visible`. No hay que hacer nada
en cada componente salvo no estropearlo.

---

## Teclado

Toda la interfaz se maneja sin ratón. La prueba es de treinta segundos y la hace cualquiera:

1. Abre la página y pulsa Tab.
2. Lo primero que aparece debe ser **"Saltar al contenido principal"**.
3. Sigue tabulando: ¿se ve siempre dónde estás? ¿llegas a todo? ¿puedes accionar los botones con
   Enter o Espacio?
4. ¿Te quedas atrapada en algún sitio del que no se sale con teclado?

Si algo falla ahí, no está terminado.

---

## Imágenes e iconos

- **Icono decorativo** (al lado de un texto que ya dice lo mismo): `aria-hidden="true"`.
  Si no, el lector de pantalla lee ruido.
- **Botón de solo icono**: `aria-label` que describa la acción, y que **cambie con el estado**
  ("Silenciar micrófono" / "Activar micrófono").
- **Imagen con contenido**: texto alternativo que diga **lo que comunica**, no lo que es.
  No "imagen de una gráfica", sino "las inscripciones subieron un 40% en marzo".

---

## Animación

Todo lo que se mueve respeta `prefers-reduced-motion`. Hay dos capas, porque una sola no basta:

- **CSS**: [`globals.css`](../../src/app/globals.css) neutraliza transiciones y animaciones
  declarativas.
- **JavaScript**: Motion anima sin pasar por CSS, así que hay que preguntárselo con
  `useReducedMotion`. Está resuelto en [`src/lib/motion.ts`](../../src/lib/motion.ts): usa ese
  helper y no tendrás que pensarlo.

Cuando el sistema pide menos movimiento, el contenido **sigue apareciendo**: se quita el
desplazamiento, no la aparición. Si se eliminara la animación entera, un fallo dejaría elementos
invisibles para siempre.

---

## Las dos pruebas que no salen solas

Los `max-width` esconden los fallos de alto. Estas dos hay que hacerlas **desde el principio**, no
el último día:

**Móvil en horizontal.** Pantalla ancha y bajita. Los modales y las salas de vídeo se rompen aquí
con una facilidad sorprendente: la barra de controles queda fuera y no hay forma de colgar.

**Zoom al 200%.** Ctrl + + hasta el 200%. Es un gesto cotidiano, no un caso raro. El texto debe
seguir leyéndose sin scroll horizontal y sin que se solapen las cosas.

---

## Sobre ARIA

**ARIA es una promesa, no una garantía.** Un atributo correcto según la especificación no asegura
que el lector de pantalla lo anuncie: cada motor la implementa a su manera.

Cuando uses un `role` o un patrón ARIA que no sea trivial, di en la spec **qué queda por
verificar a mano**. Y si puedes, escúchalo: el Narrador de Windows o VoiceOver en Mac están
instalados ya. Lo que importa de verdad hay que oírlo, no leerlo.

Regla práctica: si un elemento HTML nativo hace el trabajo (`<button>`, `<dialog>`, `<nav>`),
úsalo. Tiene el comportamiento de teclado y el anuncio correcto de serie.

---

## Un componente correcto con un dato incompleto es un fallo

Puede pasar que la interfaz sepa pintar algo que el dato real nunca trae. Cada mitad pasa su
revisión y el conjunto falla.

Por eso se mira **la página con datos reales**, no solo el archivo del componente. Es la misma
razón por la que el fallo de los iconos del primer día pasó typecheck y lint: el código era
correcto, la página estaba rota.

---

## Lo que la demo se salta a propósito

> **La propuesta de Mia dentro de la videollamada existe solo en audio.** Decidido el 2026-09-19.

Cuando Mia pide la palabra y se la dan, dice su propuesta en voz y debajo aparecen únicamente los
dos botones. El texto de lo que ha dicho no se enseña.

**Es un fallo de AA y está aceptado para la demo**, no es un descuido. El motivo: repetir por
escrito lo que se acaba de oír dejaba la voz de adorno —se leía la propuesta antes de que
terminara de hablar— y llenaba media pantalla de móvil con algo ya dicho.

Lo que esto rompe, dicho en voz alta:

- Quien no oye se queda sin saber qué le proponen. Los botones dicen «Llama» y «Ya lo veo yo», que
  sin la pregunta no dicen a quién ni por qué.
- Y quien apague el sonido para cortar el eco entre dos aparatos se queda igual.

**Cómo se arregla fuera de una demo**, que no es volviendo a poner el texto siempre: se enseña
cuando la voz no suena. Si el clip no se pudo generar, o el sonido está apagado, o alguien lo pide,
la propuesta se lee. Cuando sí suena, se oye y ya está.

Eso es trabajo de media hora y no entra este fin de semana.

---

## En cada pull request

La plantilla lo pregunta, pero aquí está el porqué de cada punto:

- [ ] Se puede usar solo con teclado, con el foco siempre visible
- [ ] Probado a 200% de zoom
- [ ] Probado en móvil en horizontal
- [ ] Iconos decorativos con `aria-hidden`, botones de solo icono con `aria-label`
- [ ] Contraste ≥ 4,5:1 en texto normal y ≥ 3:1 en texto grande y gráficos, si has tocado colores
