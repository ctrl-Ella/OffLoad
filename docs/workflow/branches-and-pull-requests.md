# Ramas y pull requests

Cómo trabajamos las cuatro sobre el mismo código sin pisarnos.

---

## El mapa

```
main                 lo estable, lo que se entrega
 └── dev             integración: todo pasa por aquí
      ├── feature/12-sala-de-video
      ├── fix/18-token-caducado
      └── docs/21-guia-de-vonage
```

**Nadie trabaja directamente en `main` ni en `dev`.** Siempre una rama propia, siempre partiendo
de `dev`.

---

## El ciclo completo

```bash
# 1. Partir de dev actualizado
git checkout dev
git pull

# 2. Rama nueva, con el numero de la issue en el nombre
git checkout -b feature/12-sala-de-video

# 3. Trabajar y guardar (ver commits.md)
git add .
git commit -m "feat(video): crear sala con el SDK de Vonage"

# 4. Antes de subir: lo mismo que hara CI
npm run typecheck && npm run lint

# 5. Subir y abrir la PR hacia dev
git push -u origin feature/12-sala-de-video
```

### Por qué el número de la issue va en el nombre de la rama

Porque une la conversación con el código. Dentro de dos días, cuando alguien mire
`feature/12-sala-de-video`, encuentra en la issue #12 por qué se hizo así y qué se descartó. Una
rama llamada `arreglos` no le dice eso a nadie, ni siquiera a quien la creó.

### Tipos de rama

| Prefijo | Para qué |
|---|---|
| `feature/` | Funcionalidad nueva |
| `fix/` | Corregir algo que está mal |
| `docs/` | Solo documentación |
| `refactor/` | Reorganizar código sin cambiar lo que hace |
| `chore/` | Dependencias, configuración, tareas de mantenimiento |

---

## La pull request

Siempre **hacia `dev`**. La plantilla se rellena sola al abrirla, y lleva una lista de
comprobación que hay que completar de verdad:

- [ ] La **spec** está actualizada (`docs/specs/`)
- [ ] La **documentación** afectada está actualizada
- [ ] El **CHANGELOG** tiene una línea sobre esto
- [ ] El cuerpo incluye `closes #NN`
- [ ] `npm run typecheck` y `npm run lint` pasan

### Quien escribe el código no aprueba su propia PR

Es la regla que no se negocia. Si el mismo lado escribe el arreglo y la constancia de que
funciona, el registro deja de verificar nada: se convierte en un trámite que nadie lee.

Cada PR la mira **otra persona del equipo** antes de mezclarse.

**Esto es un acuerdo entre nosotras, y GitHub ya no lo exige.** Se quitó la aprobación
obligatoria durante la hackatón: con una sola cuenta trabajando a ratos, la regla bloqueaba el
propio andamiaje en lugar de proteger nada. Lo que GitHub sí sigue exigiendo es que haya pull
request y que la CI esté en verde.

Que no lo exija una máquina no lo hace opcional: lo hace nuestro. Y fuera de un fin de semana,
esta es de las primeras cosas que conviene volver a activar.

### Revisar una PR de otra persona

No es buscar fallos: es entender el cambio antes de que sea de todas. Tres preguntas bastan:

1. ¿Hace lo que dice la issue, ni más ni menos?
2. ¿Lo entendería dentro de una semana sin preguntar?
3. ¿Qué pasa si el dato llega vacío, o el usuario hace doble clic, o se cae la red?

Si algo no se entiende, la pregunta correcta es "¿por qué así?", no "esto está mal".

---

## De `dev` a `main`

Cuando `dev` está estable y sin conflictos, se abre una PR de `dev` a `main`. Eso es una
*release*: lo que hay en `main` es lo que se enseña y se entrega.

### A `main` solo entra `dev`, y ahora hay una máquina comprobándolo

Ninguna rama de trabajo abre una pull request contra `main`. Ni una corrección de una línea, ni
un cambio que «solo toca estilos», ni algo urgente: todo entra por `dev` y llega a `main` en la
siguiente release.

**El motivo está comprobado en este repositorio.** Las pull requests #12 y #13 fueron directas a
`main` en una misma tarde. Dejaron allí un reparto de hojas de estilo —`src/app/styles/`, 350
líneas— que `dev` no tiene, sobre un `globals.css` que `dev` también había tocado. A partir de
ahí, la siguiente release deja de ser un avance limpio y pasa a ser un conflicto que hay que
resolver a mano, y mientras tanto quien sale de `dev` trabaja sin unos estilos que ya están
publicados.

La protección de ramas no puede expresar esto: gobierna los push, no hacia dónde apunta una pull
request. Por eso es una comprobación,
[`check-pr-target.yml`](../../.github/workflows/check-pr-target.yml), y va en los checks
obligatorios del ruleset de `main` — si no, avisa pero no bloquea.

Si una pull request está mal dirigida, se redirige sin perder nada, ni los commits ni la
conversación:

```bash
gh pr edit <número> --base dev
```

---

## Lo que GitHub hace cumplir

El repositorio es **público y está en una organización**, y eso permite (con plan gratuito)
proteger las ramas de verdad. Las reglas están escritas en
[`.github/rulesets/`](../../.github/rulesets/) y se aplican con
[`scripts/configure-github.sh`](../../scripts/configure-github.sh).

| Rama | Qué impide |
|---|---|
| `main` | Push directo · reescritura del historial · exige PR · exige CI en verde · no se puede borrar |
| `dev` | Push directo · reescritura del historial · exige PR · exige CI en verde · no se puede borrar |

**La aprobación obligatoria está en cero durante la hackatón**, y es lo único que se ha aflojado.
Que otra persona revise sigue siendo el acuerdo del equipo; lo que ya no hay es una máquina
comprobándolo.

No son decoración. Sin ellas, el flujo se lo salta quien va con prisa a las tres de la
madrugada, que es exactamente cuando más falta hace.

---

## El detalle que casi nos pilla: `closes #12` no cierra nada

La documentación de GitHub es literal:

> Las palabras clave especiales en una pull request se interpretan **solo cuando la pull request
> apunta a la rama por defecto del repositorio**. Si apunta a cualquier otra rama, se ignoran.

Nuestra rama por defecto es `main`, pero las PR van a `dev`. O sea: **`closes #12` en una PR a
`dev` no cerraría la issue**, y nos habríamos pasado la hackatón cerrándolas a mano sin entender
por qué.

Por eso existe [`.github/workflows/close-issues.yml`](../../.github/workflows/close-issues.yml):
lee el cuerpo de la PR al mergearse en `dev` y cierra las issues que menciona. Sigue escribiéndose
`closes #12` igual; solo cambia quién lo ejecuta.

---

## Si se cuela un secreto en el repositorio

Puede pasar: una clave pegada en un archivo, un `.key` de Vonage arrastrado sin querer.

**Borrarlo en el commit siguiente no sirve de nada.** El repositorio es público y el historial se
puede clonar entero: esa clave la tiene cualquiera que haya pasado por ahí.

El orden correcto es:

1. **Rotar la clave primero.** Invalídala en Nebius o Vonage y genera una nueva. Hasta que no
   hagas esto, la clave sigue siendo válida para quien la haya copiado.
2. **Avisar al equipo**, para que nadie siga usando la antigua.
3. **Después**, limpiar el historial si procede.

Primero se cierra la puerta, luego se recoge.

GitHub nos ayuda: en repositorios públicos el escaneo de secretos está activo y **bloquea el
push** si detecta una clave conocida. Es una red de seguridad, no una excusa para no mirar.
