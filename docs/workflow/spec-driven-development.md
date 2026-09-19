# Spec Driven Development

Primero se escribe qué se va a hacer y cómo se sabrá que está hecho. Después se programa.

No es papeleo: es la diferencia entre cuatro personas construyendo lo mismo y cuatro personas
construyendo cuatro cosas parecidas que no encajan. En una hackatón, descubrir eso el domingo por
la mañana es perder el proyecto.

---

## El circuito

```
1. SPEC       docs/specs/00NN-nombre.md
              qué problema resuelve y cómo se sabrá que funciona
                      ↓
2. ISSUE      [area] Descripción — enlaza la spec
              se añade sola al tablero
                      ↓
3. RAMA       feature/NN-descripcion, desde dev
                      ↓
4. PR         hacia dev, con "closes #NN" y la lista de comprobación
                      ↓
5. CI         typecheck + lint + build, automático
                      ↓
6. REVISIÓN   otra persona del equipo, nunca quien lo escribió
                      ↓
7. MERGE      a dev → la issue se cierra sola → CHANGELOG actualizado
```

### Por qué el retorno se monta antes que la detección

Encontrar un fallo es la parte barata. Lo caro es que el hallazgo llegue a quien lo arregla y que
la corrección vuelva a quien lo encontró.

Quien reporta necesita saber qué pasó con lo que reportó, o deja de reportar. Y un hallazgo sin
respuesta no desaparece: reaparece en una hoja de cálculo paralela, en un mensaje suelto, en un
"ah, sí, eso ya lo vi" el día de la entrega.

Por eso la issue se cierra sola y CI avisa sin que nadie pregunte: el circuito de vuelta está
montado **antes** de empezar a encontrar cosas.

---

## Qué lleva una spec

La plantilla está en [`docs/specs/0000-plantilla.md`](../specs/0000-plantilla.md). Se copia, se
renumera y se rellena.

| Sección | Qué responde |
|---|---|
| **Problema** | Qué pasa hoy que no debería pasar. Sin hablar de solución |
| **Criterios de aceptación** | Cómo sabremos que está hecho. **Verificables**, no opiniones |
| **Alcance** | Qué entra |
| **Fuera de alcance** | Qué NO entra, aunque se parezca |
| **Decisiones** | Qué se eligió y qué se descartó, con el porqué |
| **Verificación** | Los pasos concretos para comprobarlo |
| **Estado** | Borrador · Aprobada · Implementada |

### "Fuera de alcance" es la sección más útil

Es la que evita la conversación de las cuatro de la madrugada: *"pensaba que esto también
entraba"*. Escribir lo que **no** vas a hacer cuesta un minuto y ahorra dos horas.

### Los criterios de aceptación se comprueban, no se opinan

| Mal | Bien |
|---|---|
| La sala de vídeo funciona bien | Dos personas en navegadores distintos se ven y se oyen |
| Es rápido | El vídeo aparece en menos de 3 segundos desde que se pulsa Entrar |
| Es accesible | Se puede entrar y salir de la sala solo con teclado, con el foco siempre visible |

Si no se puede comprobar, no es un criterio: es un deseo.

---

## Ninguna PR pasa sin actualizar la spec

Está en la lista de comprobación de la plantilla de PR, y es motivo suficiente para no aprobar.

La razón: si el código evoluciona y la spec no, la spec empieza a mentir. Y una documentación que
miente es peor que no tener ninguna, porque la gente confía en ella y toma decisiones con datos
falsos.

**Si durante la implementación descubres que la spec estaba equivocada** —que suele pasar, y está
bien— actualízala en la misma PR explicando qué cambió. La spec no es una promesa: es el estado
actual de lo que entendemos.

---

## Lo mismo aplica a la documentación

Si tu cambio afecta a cómo se arranca el proyecto, a una integración o al flujo de trabajo,
**actualiza la guía en la misma PR**. No "después".

"Después" es el jueves siguiente, cuando ya nadie recuerda el detalle que hacía falta.
