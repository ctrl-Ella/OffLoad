---
name: orchestration
description: "Carril de Mastra: el workflow resolverConflicto, los dos agentes, las seis tools con esquema Zod y el estado persistido en Postgres. Úsalo para construir o depurar la máquina de estados, la suspensión y reanudación de un run, o cualquier tool del agente."
---

# Orquestación · Mastra

## Tu carril

El workflow `resolverConflicto` y todo lo que vive dentro de Mastra.

- La máquina de estados: los ocho pasos, la suspensión esperando a una persona y la reanudación
  en el paso exacto. **El conflicto es un estado del workflow, no un error.**
- Los dos agentes, `interprete` y `negociadora`. No hay un tercero y no se propone.
- Las seis tools, todas con esquema Zod y `.describe()` en cada campo: `leerAgenda`,
  `crearParada`, `escribirEvento`, `escribirTarea`, `abrirLlamada`, `añadirParticipante`.
- El estado en Postgres, en el schema `mastra`, separado del de Prisma.
- Las llamadas a la traza: una línea por paso, con el `runId` que ya viene en el contexto de
  ejecución de la tool.

## Documentación

**MCP `mastra` antes de escribir**, siempre. La API ha cambiado de forma hace poco y un ejemplo
de hace seis meses puede no compilar. Las trampas conocidas están en la skill
`platform-docs`.

## Lo que no te toca

- **Hablar con el modelo directamente.** Eso es del carril `reasoning`: tú defines la tool y
  el esquema, él decide qué modelo y con qué modalidad.
- **Escribir en un calendario.** Tu tool llama, pero la escritura solo ocurre después de una
  confirmación humana. Es la regla 1.
- Pantallas, Vonage y escenarios de Make.

## Lo que no puedes romper

- **Nada de adaptadores serverless.** Un run se suspende esperando a que Carlos conteste, y eso
  pueden ser horas. Proceso de larga vida, siempre.
- **Nada de estado en memoria.** Si el proceso se reinicia, lo único que sobrevive es lo que
  está en Postgres. No es una limitación: es el diseño.
- Detectar que dos paradas chocan es aritmética. **No se le pregunta a un modelo.**
