## Qué hace

<!-- En una o dos frases. Si necesitas más, quizá son dos PR. -->

closes #

## Por qué

<!-- El contexto que no se ve en el código. Qué se descartó y por qué, si viene al caso. -->

## Cómo comprobarlo

<!-- Los pasos que va a seguir quien revise. Que se basten solos. -->

1.
2.
3.

## Antes de pedir revisión

- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa
- [ ] La **spec** de `docs/specs/` está actualizada (o no aplica, y lo digo abajo)
- [ ] La **documentación** afectada está actualizada
- [ ] El **CHANGELOG** tiene una línea sobre esto
- [ ] El cuerpo lleva `closes #NN` con el número real
- [ ] No hay claves, tokens ni archivos `.key` en el diff

## Si toca interfaz

- [ ] Se puede usar solo con teclado, y el foco se ve siempre
- [ ] Probado a **200% de zoom**
- [ ] Probado en **móvil en horizontal** (los fallos de alto no salen probando anchos)
- [ ] Los iconos decorativos llevan `aria-hidden`; los botones de solo icono, `aria-label`
- [ ] Contraste ≥ 4,5:1 en texto normal y ≥ 3:1 en texto grande y gráficos, si he tocado colores
- [ ] Se ve bien en móvil, en pantalla de ordenador y en pantalla grande

---

<!--
Recordatorio: quien escribe el código no aprueba su propia PR.

Durante la hackatón GitHub ya no lo exige, así que depende de nosotras. Que no
lo compruebe una máquina no lo hace opcional: lo hace nuestro.
-->
