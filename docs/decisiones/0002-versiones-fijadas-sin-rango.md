# 0002 — Versiones fijadas sin rango

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 2026-09-13 |

## Contexto

Por defecto npm escribe `"next": "^16.3.5"`, que significa "cualquier 16.x a partir de esta". En
un proyecto largo eso trae parches de seguridad sin esfuerzo. En una hackatón de fin de semana
significa que alguien instala el sábado por la tarde y se trae una versión distinta de la que
probamos el viernes.

Cuatro personas, cuatro ordenadores: la única forma de que "en mi máquina funciona" signifique
algo es que todas tengan exactamente lo mismo.

## Decisión

Todas las dependencias fijadas a versión exacta, sin `^` ni `~`. El `package-lock.json` se
versiona y CI usa `npm ci`, que instala exactamente lo del lock sin actualizar nada.

## Consecuencias

**A favor:** las cuatro ejecutan el mismo código, y CI también. Un fallo es reproducible.

**En contra:** los parches de seguridad no llegan solos; hay que subirlos a mano. Para una
hackatón de tres días es un coste irrelevante; para un proyecto de meses habría que revisarlo.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Rangos `^` con lock versionado | El lock ya da reproducibilidad, pero quien ejecuta `npm install <algo>` puede actualizar medio árbol sin darse cuenta |
| Renovate o Dependabot | Herramienta que mantener y ruido de PRs en un fin de semana |
