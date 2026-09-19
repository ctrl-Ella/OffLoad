# OFFLOAD

Una aplicación familiar que reparte la carga mental. Mia, el agente, encuentra los problemas antes de que nadie los vea, resuelve sola lo que no cambia el plan de nadie, y solo pide un sí o un no cuando hace falta. Lo que devuelve, medido, es tiempo.

[![Estado de la integración continua en la rama main](https://github.com/ctrl-Ella/OffLoad/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ctrl-Ella/OffLoad/actions/workflows/ci.yml)
[![Número de issues abiertas](https://img.shields.io/github/issues/ctrl-Ella/OffLoad?label=issues%20abiertas)](https://github.com/ctrl-Ella/OffLoad/issues)
[![Número de pull requests abiertas](https://img.shields.io/github/issues-pr/ctrl-Ella/OffLoad?label=pull%20requests)](https://github.com/ctrl-Ella/OffLoad/pulls)
[![Fecha del último cambio](https://img.shields.io/github/last-commit/ctrl-Ella/OffLoad?label=último%20cambio)](https://github.com/ctrl-Ella/OffLoad/commits/main)

Proyecto del equipo CTRL4ELLA para HackBarna AI Summit 26.

> **Estado:** en construcción. El esqueleto está en pie y la integración continua en verde. El producto se está montando encima.

---

## El problema

La carga mental de una casa no son las tareas: es acordarse de que existen. Quién lleva al niño a la piscina el jueves si esa tarde hay reunión, si alguien pasa cerca del supermercado de camino a otro sitio, a quién se le puede pedir ayuda sin quedar mal.

Eso no se reparte con una lista compartida, porque la lista también hay que llevarla.

## Cómo funciona

Mia observa las agendas del núcleo familiar y encuentra los choques antes de que ocurran. Y entonces se hace una sola pregunta:

> **¿Esto cambia el plan de alguien?**

| Respuesta | Qué hace Mia |
|---|---|
| No lo cambia | Lo resuelve sola y lo notifica. Acoplar un recado a un trayecto que alguien ya iba a hacer, reordenar recordatorios, montar la lista de la compra |
| Sí lo cambia | Lo prepara entero y pide un sí o un no. Una tarjeta, dos botones |
| No se resuelve con un sí o un no | Videollamada. Es la excepción, y que sea rara es la métrica de éxito |

La interfaz es móvil primero, la entrada principal es la voz, y todo el producto está en español de España.

### Dos círculos, y la diferencia es estructural

El **núcleo** conecta su Google, y Mia ve sus agendas. La **red de apoyo** —un abuelo, una vecina, un amigo— solo está en la lista de contactos: Mia no ve nada suyo, no puede saber si están libres y **nunca afirma su disponibilidad**. Para saberlo hay que llamarles, y por eso existe la videollamada.

## La tesis técnica

> **El modelo interpreta, el workflow decide.**

Detectar que dos paradas chocan es aritmética sobre horas y distancias, y eso no se le pregunta a un modelo de lenguaje. Al modelo se le da solo lo que una máquina determinista no sabe hacer: entender una frase dicha en voz alta y elegir a quién conviene pedirle qué.

De los ocho pasos de un run, solo dos tocan un modelo, y el que más decide no lo toca.

El estado vive en Postgres, así que el proceso se suspende esperando a que una persona conteste y se reanuda en el paso exacto, aunque el servidor se reinicie por medio. El conflicto es un estado del sistema, no un error.

## Quién pone qué

| Pieza | Responsabilidad |
|---|---|
| **Mastra** | Orquestación, estado y herramientas tipadas |
| **Nebius Token Factory** | Todo el razonamiento, en dos niveles de modelo |
| **Vonage** | La sesión de vídeo, las transcripciones en directo y el puente telefónico |
| **SLNG** | Lo que Mia dice y lo que oye fuera de la llamada |
| **Google** | Calendar y Tasks del núcleo |
| **Make** | Los efectos secundarios de una decisión ya tomada |

Encima de Next.js 16, React 19, Prisma 7 y Tailwind 4, con TypeScript en todo.

## Las seis reglas que no se rompen

Están cubiertas por pruebas y bloquean la mezcla:

1. Nunca se escribe en un calendario sin confirmación humana
2. Mia no emite audio sin que alguien le haya dado la palabra
3. Nunca se afirma la disponibilidad de alguien de la red de apoyo
4. Mia no anuncia nada que todavía no sea verdad
5. La cercanía se calcula entre paradas, nunca entre personas
6. Las cifras de tiempo se calculan o se declaran como estimación

## Cómo arrancarlo

Hace falta Node 22.13 o superior y una base de datos Postgres.

```bash
npm ci
cp .env.example .env        # y rellenar los valores
npx prisma generate
npm run dev
```

Las credenciales que hay que dar de alta, en qué orden y con qué trampas, están en `docs/guias/`. El `.env` no se sube nunca: lo que se versiona es `.env.example`, con los nombres de las variables y sin un solo valor.

## Recorrido web actual

La portada presenta a Mia con un GIF de parpadeo suave, un ejemplo de agenda familiar y el camino hacia una llamada de coordinación. Hay tres vistas: inicio, llamada y resumen del tiempo potencial para el bienestar personal. La pantalla de notas de voz se ha retirado del frontend actual.

La sala de vídeo usa `/api/video/room` y los SDK de Vonage. La persona que abre la sala recibe un enlace temporal para invitar a otras personas; cada participante recibe su propio token. Configura `VONAGE_APPLICATION_ID`, `VONAGE_PRIVATE_KEY_PATH` y `VONAGE_API_SECRET` en `.env`. La ruta de la clave debe apuntar al archivo privado de esa aplicación. La cámara y el micrófono requieren `localhost` o HTTPS.

Google Calendar y la orquestación del agente quedan para una siguiente fase. Por ahora, la agenda y los minutos de bienestar se muestran como ejemplos, y ningún cambio se escribe en un calendario.

## Cómo trabajamos

`main` es producción y `dev` es donde se integra. Cada rama sale de `dev` con el número de su issue en el nombre, y vuelve por pull request. Ninguna tarea empieza por el código: primero se escribe qué se va a hacer y cómo se sabrá que está hecho.

| Dónde | Qué hay |
|---|---|
| [`docs/workflow/`](docs/workflow/) | Ramas y pull requests, commits, issues y etiquetas, spec driven development |
| [`docs/specs/`](docs/specs/) | Una spec por tarea, más la plantilla |
| [`docs/decisiones/`](docs/decisiones/) | Las decisiones de arquitectura, con sus alternativas descartadas |
| [`docs/guias/`](docs/guias/) | Accesibilidad y automatizaciones |
| [`CLAUDE.md`](CLAUDE.md) | El contexto con el que trabajan las sesiones de Claude Code |
| [`CHANGELOG.md`](CHANGELOG.md) | Qué ha cambiado, una línea por pull request |

## Accesibilidad

El listón es **EN 301 549, que remite a WCAG 2.1 nivel AA**, y es una decisión de alcance razonada en [`docs/guias/accesibilidad.md`](docs/guias/accesibilidad.md).

Lo que no depende de ese nivel se cumple igual: foco siempre visible, teclado completo, etiquetas reales, `prefers-reduced-motion`, móvil en horizontal y zoom al 200 %. Cada token de color lleva anotado su contraste medido, porque un token es una promesa y sin medirla se rompe en silencio.
