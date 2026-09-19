---
name: razonamiento
description: "Carril de Nebius Token Factory: los dos niveles de modelo, la salida estructurada por JSON Schema, el enrutado entre modelo pequeño y grande, las modalidades base y -fast, la cuota y el banco de pruebas. Úsalo para elegir modelo, medir, o depurar una llamada a Nebius."
---

# Razonamiento · Nebius

## Tu carril

Todo lo que pasa por un modelo, y solo eso: de los ocho pasos de un run, dos.

- **El enrutado de dos niveles.** El modelo pequeño clasifica intención, el grande construye la
  propuesta. Engancha siempre antes el pequeño: si el clasificador acierta, el grande es media
  hora más.
- **Salida estructurada en toda llamada.** `response_format: { type: "json_schema" }` activa
  decodificación restringida en el motor vLLM: el modelo no puede emitir un token que rompa el
  esquema. No se escribe parseo defensivo ni reintentos de formato.
- **Modalidad por carga.** `-fast` dentro de la videollamada, `base` para el resto, Batch API
  para el resumen del viernes.
- **Cuota y resiliencia.** Se lee `Retry-After` y se respeta lo que dice, no lo que apetece. Se
  conmuta de `-fast` a base ante fallos sostenidos, sin que el usuario lo note.
- **El banco de pruebas de `bench/`.** Acierto, coste, TTFT, grounding y disponibilidad
  inventada. Es lo que convierte una decisión de modelo en una tabla en lugar de en una opinión.

## Documentación

Nebius **no publica MCP**: se consulta con WebFetch. Y antes de cada tanda, el catálogo vivo:

```bash
curl -H "Authorization: Bearer $NEBIUS_API_KEY" $NEBIUS_BASE_URL/models
```

Dos trampas que cuestan una tarde, ampliadas en la skill `consultar-docs-sponsors`:

- El catálogo se mueve y **los checkpoints retirados no redirigen el tráfico**. Un identificador
  fijo en el código es una avería futura: salen del entorno.
- **En Mastra los modelos llevan prefijo `nebius/`. En la API de Token Factory no lo llevan.**

## Lo que no te toca

- **Decidir.** El modelo interpreta, el workflow decide. Detectar un choque entre paradas es
  aritmética y no pasa por aquí.
- **El audio.** El catálogo de Nebius es texto. Lo que Mia dice y oye fuera de la llamada es
  SLNG; dentro de la llamada, Live Captions de Vonage.
- Definir tools y esquemas: eso es del carril `orquestacion`.

## Lo que no puedes romper

- **Los precios se rellenan desde el panel, no se estiman.** Mientras estén a cero, el informe
  dice «sin precio». Una cifra inflada se nota y arrastra la credibilidad del resto de números.
- **Disponibilidad inventada: umbral cero.** Una sola confabulación sobre alguien de la red de
  apoyo rompe la regla 3.
