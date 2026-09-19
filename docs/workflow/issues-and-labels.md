# Issues, etiquetas y tablero

Una issue es la unidad de trabajo: si algo no tiene issue, no existe. Así cualquiera sabe en
treinta segundos quién está con qué, sin preguntar por el grupo.

---

## El título

```
[area] Verbo en infinitivo + qué
```

GitHub pone el número solo; no hay que inventárselo:

```
#12  [backend]   Crear endpoint de sesiones de vídeo
#13  [frontend]  Montar la sala de vídeo con el SDK de Vonage
#14  [qa]        Verificar la sala con dos participantes reales
#15  [devops]    Publicar la app en un entorno accesible desde fuera
#16  [ia]        Resumir la conversación al terminar la llamada
```

El área entre corchetes se ve en la lista sin abrir nada ni fijarse en el color de una etiqueta.
La etiqueta `area:` va igualmente, porque es lo que permite filtrar.

**Áreas:** `frontend` · `backend` · `qa` · `devops` · `ia` · `video` · `docs`

---

## Las etiquetas

Se crean **una vez** con [`scripts/configure-github.sh`](../../scripts/configure-github.sh) y se
reutilizan siempre. La fuente única es [`.github/labels.yml`](../../.github/labels.yml).

Si creas etiquetas nuevas sobre la marcha, en dos días hay `bug`, `Bug`, `bugs` y `error`, y
ningún filtro sirve para nada.

| Grupo | Etiquetas | Para qué |
|---|---|---|
| **Área** | `area:frontend` `area:backend` `area:qa` `area:devops` `area:ia` `area:video` `area:docs` | Quién lo coge |
| **Tipo** | `tipo:feature` `tipo:bug` `tipo:tarea` `tipo:spec` | Qué clase de trabajo es |
| **Prioridad** | `prio:alta` `prio:media` `prio:baja` | Qué va antes |
| **Estado** | `estado:bloqueada` `estado:en-revision` | Por qué no avanza |

Cada issue lleva **como mínimo** un `area:` y un `tipo:`.

`estado:bloqueada` es la más útil de todas y la que más se olvida: si algo te frena, etiquétalo y
di en un comentario qué esperas. Una tarea bloqueada en silencio es una tarea que nadie está
haciendo y todo el mundo cree que avanza.

---

## Las plantillas

Al abrir una issue, GitHub ofrece tres formularios
([`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/)):

| Plantilla | Cuándo |
|---|---|
| **Funcionalidad** | Algo nuevo que el producto tiene que hacer. Pide enlazar la spec |
| **Error** | Algo que ya existe y no funciona. Pide pasos para reproducirlo |
| **Tarea técnica** | Trabajo interno sin cara visible: configuración, dependencias, CI |

Los formularios ponen los campos obligatorios. No es burocracia: es que "no va el vídeo" no se
puede arreglar, y "al entrar en la sala con Firefox, la cámara se queda en negro y la consola
dice X" sí.

---

## El tablero (Project)

Las issues **se añaden solas**. GitHub Projects trae un automatismo integrado que las mete al
crearse, sin escribir código: en el tablero, *Workflows → Auto-add to project*, filtrando por
`is:issue is:open`.

Columnas sugeridas, que son las que responden a "¿cómo vamos?":

```
Por hacer  →  En curso  →  En revisión  →  Hecho
```

Mueve tu issue a **En curso** cuando empieces de verdad, no cuando la leas. Un tablero donde todo
está "en curso" no informa de nada.

---

## Cuándo se cierra una issue

**Sola**, al mergear la PR que la resuelve en `dev`, gracias a
[`.github/workflows/close-issues.yml`](../../.github/workflows/close-issues.yml). Tú solo
escribes `closes #12` en el cuerpo de la PR.

(Sin ese workflow no se cerraría: GitHub solo interpreta esas palabras clave si la PR apunta a la
rama por defecto, y las nuestras van a `dev`. Está explicado en
[branches-and-pull-requests.md](branches-and-pull-requests.md).)

**Nunca cierres una issue a mano** porque "ya está hecho" si no hay PR mergeada. Si de verdad no
hacía falta código, ciérrala con un comentario que diga por qué. Dentro de un mes, ese comentario
es la única explicación que va a quedar.
