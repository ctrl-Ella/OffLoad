# Commits

Usamos **commits convencionales**. No por ceremonia: un historial legible es lo que permite saber
qué cambió y por qué sin abrir veinte archivos, y permite generar el CHANGELOG casi solo.

---

## El formato

```
tipo(ámbito): descripción en imperativo
```

```bash
feat(video): crear sala con el SDK de Vonage
fix(chat): evitar doble envío al pulsar Enter dos veces
docs(workflow): explicar por qué closes no funciona en dev
chore(deps): fijar prisma en 7.10.0
```

**Reglas cortas:**

- Título de **72 caracteres como máximo**.
- En **imperativo**: "crear", no "creado" ni "creando". Se lee como una orden: *este commit
  crea la sala*.
- Minúscula inicial, sin punto final.
- Si necesitas explicar el porqué, va en el cuerpo, separado por una línea en blanco.

## Los tipos

| Tipo | Cuándo |
|---|---|
| `feat` | Funcionalidad nueva |
| `fix` | Corrección de algo que fallaba |
| `docs` | Solo documentación |
| `style` | Formato, espacios, comas — nada que cambie el comportamiento |
| `refactor` | Reorganizar sin cambiar lo que hace |
| `test` | Añadir o arreglar pruebas |
| `chore` | Dependencias, configuración, mantenimiento |
| `ci` | Workflows de GitHub Actions |

## Los ámbitos que usamos

`video` · `chat` · `ia` · `db` · `ui` · `auth` · `docker` · `workflow` · `deps`

No es una lista cerrada: si necesitas uno nuevo y tiene sentido, úsalo y añádelo aquí.

---

## Cuándo hacer commit

Cuando una idea está completa, aunque sea pequeña. Un commit debería poder describirse en una
frase sin usar "y".

Si tu mensaje es `feat(video): crear sala y arreglar el login y actualizar deps`, son tres
commits, no uno. Cuando algo se rompa, poder revertir uno de los tres sin arrastrar los otros es
lo que salva la tarde.

---

## Acentos en Windows: hay que configurarlo

Git en Windows no usa UTF-8 por defecto. Sin configurarlo, "añadir configuración" acaba en el
historial como `a\303\261adir configuraci\303\263n`, y los nombres de archivo con tilde se ven
igual de mal.

**Una sola vez por máquina:**

```bash
git config --global core.quotepath false
git config --global i18n.commitEncoding utf-8
git config --global i18n.logOutputEncoding utf-8
```

Lo hace también [`scripts/configurar-github.sh`](../../scripts/configurar-github.sh).

Y el [`.gitattributes`](../../.gitattributes) del proyecto normaliza los finales de línea, para
que nadie vea "300 líneas modificadas" solo porque escribe desde otro sistema operativo.

---

## Lo que no hacemos

- `git commit -m "cambios"` — no dice nada a nadie, tampoco a ti dentro de dos días.
- `git commit --amend` sobre algo ya subido — reescribe el historial que otras ya tienen.
- Commits con `.env`, claves o archivos `.key` — están en `.gitignore`, no los fuerces con
  `git add -f`.
- `git push --force` sobre `dev` o `main` — directamente, no.
