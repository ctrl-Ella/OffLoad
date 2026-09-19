# OFFLOAD

Proyecto del equipo CTRL4ELLA para HackBarna AI Summit 26.

Este fichero es el contexto que necesita cualquier sesión de Claude Code para no volver a discutir decisiones que ya están tomadas. Si una propuesta contradice algo de aquí, la propuesta está mal.

Vale igual para una sesión local y para una sesión en el cloud. Si estás leyendo esto desde una máquina remota, lee entera la sección **Cómo se trabaja** antes de tocar nada.

---

## Qué es

Una aplicación familiar que reparte la carga mental. Mia, el agente, encuentra los problemas antes de que nadie los vea, resuelve sola lo que no cambia el plan de nadie, y solo pide un sí o un no cuando hace falta. Lo que devuelve, medido, es tiempo.

La interfaz es móvil primero y la entrada principal es la voz. Todo el producto está en español de España.

## Las personas

| Nombre | Papel | Qué ve Mia de esa persona |
|---|---|---|
| Elvia | Usa la app | Agenda y tareas completas |
| Carlos | Su pareja | Agenda y tareas completas |
| Nicolás, abuela Rosa, vecina Marta | Red de apoyo | Solo nombre y teléfono |
| Mia | El agente | — |

**Dos círculos, y la diferencia es estructural.** El núcleo conecta su Google y Mia ve sus agendas. La red de apoyo solo está en la lista de contactos: Mia no ve nada suyo, no puede saber si están libres, y **nunca afirma su disponibilidad**. Para saberlo hay que llamarles, y por eso existe la videollamada.

---

## La regla que decide casi todo

> **¿Esto cambia el plan de alguien?**

- **No lo cambia** → Mia lo hace sola y lo notifica. Acoplar un recado a un trayecto que alguien ya iba a hacer, reordenar recordatorios, montar la lista de la compra.
- **Sí lo cambia** → Mia lo prepara entero y pide un sí o un no. Una tarjeta, dos botones.
- **No se resuelve con un sí o un no** → videollamada. Es la excepción, y que sea rara es la métrica de éxito.

---

## La tesis técnica

> **El modelo interpreta, el workflow decide.**

Detectar que dos paradas chocan es aritmética sobre horas y distancias, y no se le pregunta a un modelo de lenguaje. Al modelo se le da solo lo que una máquina determinista no sabe hacer: entender una frase dicha en voz alta y elegir a quién conviene pedirle qué.

De los ocho pasos de un run, solo dos tocan un modelo, y el que más decide no lo toca.

---

## Arquitectura

**Un workflow**, `resolverConflicto`. Máquina de estados persistida en Postgres. Se suspende esperando a una persona y se reanuda en el paso exacto. El conflicto es un estado suyo, no un error.

**Dos agentes**, y no hay un tercero:

- `interprete` · modelo pequeño · convierte habla en intención tipada
- `negociadora` · modelo grande · construye la propuesta y la redacta

**Seis tools**, todas con esquema Zod: `leerAgenda`, `crearParada`, `escribirEvento`, `escribirTarea`, `abrirLlamada`, `añadirParticipante`.

Los agentes no hablan entre ellos. Hablan a través del workflow.

## Quién pone qué

| Pieza | Responsabilidad | Lo que NO hace |
|---|---|---|
| **Mastra** | Orquestación, estado, tools tipadas | Hablar con el modelo directamente ni escribir en calendarios |
| **Nebius** | Todo el razonamiento, en dos niveles | Decidir, y tampoco audio: su catálogo es texto |
| **Vonage** | La sesión de vídeo, Live Captions, el SIP de Nicolás, Silent Auth | La lógica. Fuera del núcleo es la única forma de llegar a alguien |
| **SLNG** | Todo lo que Mia dice y lo que oye fuera de la llamada | Entender: devuelve texto, lo interpreta Nebius |
| **Google** | Calendar y Tasks del núcleo | La red de apoyo, que no conecta nada |
| **Make** | Los efectos secundarios de una decisión ya tomada | Razonar o decidir a quién se le pide qué |

**La frontera entre Mastra y Make:** si Mia necesita el resultado para seguir razonando o para enseñar algo en pantalla ahora, es una tool de Mastra. Si es una consecuencia que puede ocurrir un minuto más tarde, es Make.

---

## Reglas que no se rompen

Estas están cubiertas por tests y bloquean el merge.

1. **Nunca se escribe en un calendario sin confirmación humana.**
2. **Mia no emite audio sin que alguien le haya dado la palabra.** Pide la palabra, se enciende su recuadro, y espera.
3. **Nunca se afirma la disponibilidad de alguien de la red de apoyo.** Fuera del núcleo, el estado correcto es "no lo sé".
4. **Mia no anuncia nada que todavía no sea verdad.** Quitarle algo de encima a alguien y que luego no ocurra es peor que no haberlo intentado.
5. **La cercanía se calcula entre paradas, nunca entre personas.** No se usa la ubicación real de nadie.
6. **Las cifras de tiempo ahorrado se calculan o se declaran como estimación.** Nunca se infla un número.

---

## Convenciones de código

- **TypeScript.** La aplicación es Next.js, la orquestación es Mastra.
- **Salida estructurada siempre.** `response_format: { type: "json_schema" }` en toda llamada a Nebius. Activa decodificación restringida en vLLM: el modelo no puede romper el esquema. No hay parseo defensivo ni reintentos de formato.
- **Zod con `.describe()` en cada campo.** El esquema es el prompt. Menos instrucciones kilométricas.
- **Los identificadores de modelo no van en el código.** Salen del entorno. Nebius retira checkpoints sin redirigir el tráfico.
- **En Mastra los modelos llevan prefijo `nebius/`.** En la API de Token Factory no lo llevan.
- **Modalidad por carga:** `-fast` dentro de la videollamada, `base` para el resto, Batch API para el resumen semanal.
- **Cabeceras de cuota.** Se lee `Retry-After` y se conmuta de `-fast` a base ante fallos sostenidos.
- **Todo en español de España.** Código en inglés, textos de producto y prompts en es-ES.

---

## Antes de escribir código de Mastra o de Vonage

Las dos plataformas se mueven más rápido que los datos de entrenamiento de cualquier modelo. **Consulta sus MCP de documentación antes de proponer una API**, en vez de escribir de memoria. Están configurados en `.mcp.json` del repositorio.

Esto no es opcional: la mitad de los ejemplos de Vonage que circulan son de la generación antigua de TokBox, y la API de Mastra ha cambiado de forma recientemente.

---

## Cómo se trabaja

### Nada sale al remoto sin permiso de Irina

`git push`, abrir un pull request, publicar en cualquier servicio externo o desplegar: **se pide permiso y se espera respuesta**. Anunciarlo no basta. Commits en local, todos los que hagan falta.

El motivo es que este repositorio es público. Un push no se deshace, solo se parchea encima.

### Lo que no entra en git, nunca

- **`.env` y cualquier variante.** Lo que se versiona es `.env.example`, sin un solo valor real.
- **`private.key` de Vonage y cualquier `.key` o `.pem`.** En Railway la clave viaja como variable de entorno y el proceso la escribe a `/tmp` al arrancar.
- **`/docs-internos`.** El brief y los zips de referencia se quedan fuera: aquí viaja solo lo destilado.

Si aparece un secreto ya commiteado, la clave está quemada aunque se borre el fichero: hay que rotarla. Avisa en cuanto lo veas.

### Cómo se escribe aquí

Todo lo que se escribe en este repositorio es público y va firmado por el equipo: issues, descripciones de PR, comentarios de review, specs, ADR y documentación.

**Quién lo lee.** El jurado de la hackathon. Los patrocinadores, que miran si su plataforma se usó con criterio. Una desarrolladora que entra hoy sin contexto. Un perfil externo que llega al repositorio y se hace una idea del equipo por cómo está escrito. Un texto que funciona para las cuatro es un texto bien escrito.

**El registro es asertivo**, que no es duro ni es blando. Se dice el problema entero, se explica por qué importa y se propone una salida. Los dos extremos fallan igual: el comentario cortante que ahorra palabras a costa de quien lo recibe, y el tan suavizado que la otra persona no llega a entender que hay algo que cambiar.

Las reglas concretas:

- **Nada en negativo.** Los límites se cuentan como decisiones, porque lo son. «Descartamos la caché porque optimiza a escala y aquí no hay escala» dice más de un equipo que no mencionarla. «No nos dio tiempo» dice menos que «ese tiempo fue a la parte crítica».
- **Ni flores ni quitárselas.** Las dos hablan de quien escribe en vez de del trabajo. El punto medio se llama precisión: «el clasificador acierta el 93 % sobre treinta casos reales», y no «funciona bastante bien» ni «una arquitectura potentísima». Un número comprobado convence más que cualquier adjetivo.
- **Se habla del código, nunca de la persona.** «Este método hace dos cosas», y no «has mezclado responsabilidades».
- **Cada señalamiento lleva su porqué y una propuesta.** Sin el motivo, una corrección es una orden.
- **En una review, bloqueante y sugerencia se dicen con esas palabras.** Quien la recibe tiene que saber sin preguntar qué necesita cambiar para que se apruebe.
- **Se entiende sin haber estado ahí.** Quien lo lee no vivió el día en que pasó, ni sabe qué significan esas siglas.
- **Nada de minimizadores ni de ironía.** «Simplemente», «solo tienes que», «obviamente» y «es trivial» hacen sentir torpe a quien no lo ve. El sarcasmo por escrito no se distingue del reproche.
- **Prosa en español de España. Código, identificadores y nombres de rama en inglés.** El registro es el mismo en los dos idiomas.

La comprobación antes de publicar cualquier cosa son dos preguntas: **¿le resultaría agradable de leer a cualquiera de esas cuatro personas? ¿Se entiende sin haber estado ahí?** Si alguna respuesta es «no del todo», el texto no está terminado.

### Las ramas

```text
main                 producción: lo estable, lo que se entrega
 └── dev             donde trabajamos: todo pasa por aquí
      └── feature/12-sala-de-video
```

**Nadie trabaja directamente en `main` ni en `dev`.** Cada rama sale de `dev` actualizada y lleva el número de su issue en el nombre. Los pull request van **siempre hacia `dev`**, nunca a `main`. De `dev` a `main` se pasa con un PR aparte, y eso es una release.

Una consecuencia que conviene tener presente: GitHub solo cierra issues con `closes #12` cuando el PR apunta a la rama por defecto, que aquí es `main`. Como los nuestros van a `dev`, de eso se encarga `.github/workflows/cerrar-issues.yml`.

### Una spec por tarea, antes del código

**Ninguna tarea empieza por el código.** El orden es siempre el mismo:

```text
issue  →  spec  →  rama desde dev  →  código  →  PR a dev  →  review  →  merge
```

La spec vive en `docs/specs/`, se escribe con la plantilla de [`docs/specs/0000-plantilla.md`](docs/specs/0000-plantilla.md) y se enlaza desde el issue. Define qué entra, qué queda fuera a propósito, cuál es el contrato y cómo se comprueba que funciona.

Sirve para dos cosas concretas en un fin de semana: que dos personas no construyan la misma pieza de dos formas distintas, y que una sesión de Claude Code en el cloud pueda trabajar sola sin volver a preguntar el contexto entero.

El circuito completo está en [`docs/workflow/spec-driven-development.md`](docs/workflow/spec-driven-development.md), y el resto del proceso en [`docs/workflow/`](docs/workflow/): ramas y pull requests, commits, e issues y etiquetas.

### Las decisiones de arquitectura se escriben

Cuando una decisión cierra opciones futuras o es cara de revertir — esquema de base de datos, contrato de una API pública, un tipo compartido, la estructura de rutas — se registra en [`docs/decisiones/`](docs/decisiones/), numerada y con su contexto, sus alternativas descartadas y sus consecuencias.

Se escribe en diez minutos y evita volver a discutir lo mismo el domingo por la mañana. Una decisión que deja de valer no se borra: se marca como sustituida y se escribe la nueva encima.

### Los agentes especializados

En `.claude/agents/` hay ocho perfiles con instrucciones propias. **Uno por carril**, para que cada uno tenga un terreno claro y no se pisen:

| Agente | Su carril |
|---|---|
| `orquestacion` | Mastra: el workflow, los dos agentes, las seis tools y el estado en Postgres |
| `razonamiento` | Nebius: los dos niveles de modelo, la salida estructurada, la cuota y el banco de pruebas |
| `llamada` | Vonage: la sesión de vídeo, Live Captions, el SIP y Silent Authentication |
| `interfaz` | Las tres pantallas, los tokens de color y todo lo que se ve |
| `automatizaciones` | Make: los cinco escenarios, sus webhooks y el almacén de recordatorios |
| `qa` | Los datos de la demo, las frases habladas, el ensayo y el plan de caídas |
| `accesibilidad` | El repaso pantalla a pantalla contra el estándar del proyecto |
| `revisor-textos` | La ortografía y la gramática de todo lo que se publica |

Y dos skills en `.claude/skills/`: `consultar-docs-sponsors`, para la documentación viva de las plataformas, y `voz-de-mia`, para cómo habla el agente.

---

## Lo que deliberadamente no hacemos

- **Fine-tuning.** No hay datos propios y el problema es de orquestación.
- **Caché semántica.** Optimiza a escala, y aquí no hay escala.
- **Compensación tipo SAGA.** Con ocho pasos y un servicio crítico, un deshacer manual cubre lo mismo.
- **Más agentes.** Dos cubren todo lo que hay que interpretar.
- **Audio Connector con Pipecat.** Es por donde crece esto, pero Pipecat es un framework entero en Python.
- **El agente de voz completo con unmute.** La versión redonda, y otro proyecto.
- **Embeddings y reranker.** No hay corpus. Sería arquitectura para la foto.

---

## Dónde está cada cosa

| Ruta | Qué hay dentro |
|---|---|
| `docs/workflow/` | Cómo se trabaja: ramas y PR, commits, issues y etiquetas, spec driven development |
| `docs/specs/` | Una spec por tarea, más la plantilla |
| `docs/decisiones/` | Las decisiones de arquitectura, con su contexto y sus consecuencias |
| `docs/guias/` | Guías por tema: accesibilidad y Make |
| `.claude/agents/` | Los ocho agentes, uno por carril |
| `.claude/skills/` | Documentación viva de las plataformas y la voz de Mia |
| `.github/` | Plantillas de issue y de PR, etiquetas, CODEOWNERS, rulesets e integración continua |
| `scripts/configurar-github.sh` | Aplica etiquetas, rama `dev` y reglas de protección. Se ejecuta una vez |
| `.mcp.json` | Los MCP de documentación de Mastra y de Vonage |
| `CHANGELOG.md` | Qué ha cambiado. Una línea por pull request |

---

## Decisiones abiertas

Estas siguen pendientes y conviene cerrarlas antes de que cuesten caro.

- **El niño necesita un nombre.** Aparece en pantallas, en avisos y en la voz de Mia. En cuanto se decida, se escribe aquí y deja de discutirse.
- **Los rulesets de protección de ramas están sin aplicar.** Hasta que se ejecute `scripts/configurar-github.sh`, `main` y `dev` aceptan push directo y el flujo depende de la buena voluntad de cada una.
- **Los scripts de prueba de `package.json` y los que nombra `TESTING.md`** todavía no coinciden. Hasta que se alineen, la fuente buena es `package.json`, que es lo que ejecuta la integración continua.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
