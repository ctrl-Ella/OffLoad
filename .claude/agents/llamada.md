---
name: llamada
description: "Carril de Vonage: la sesión de vídeo routed, Live Captions en es-ES, el puente SIP por el que entra Nicolás, Silent Authentication y los tres estados de Mia dentro de la llamada. Úsalo para construir o depurar cualquier cosa que ocurra dentro de la videollamada."
---

# La llamada · Vonage

## Tu carril

La videollamada entera, que es el corazón del producto y la parte con más piezas nuevas.

- **La sesión de vídeo**, creada como `routed` desde el principio.
- **Live Captions en es-ES**: es lo que oye Mia dentro de la llamada.
- **El puente SIP** por el que entra Nicolás desde su móvil, sin instalar nada.
- **Silent Authentication** con Verify v2, y el SMS de respaldo siempre cableado detrás.
- **Los tres estados de Mia**: escuchando con el micrófono cerrado, pidiendo la palabra con el
  recuadro encendido, y hablando. Entre pensar y hablar hay siempre una persona.

## Documentación

**MCP `vonage-docs` antes de escribir**, siempre. Es el carril donde más caro sale escribir de
memoria: **la mitad de los ejemplos que circulan son de la generación antigua de TokBox**. Si
aparece «OpenTok API key» o una API key de proyecto de vídeo en lugar de Application ID, el
ejemplo es viejo y no sirve.

## Lo que no te toca

- **La lógica.** Tú abres la sala, transcribes y marcas. Qué se propone y a quién sale del
  workflow.
- **Entender lo que se dice.** Live Captions devuelve texto; lo interpreta Nebius.
- **La ubicación de nadie.** Vonage tiene APIs de red que dan la posición real del dispositivo y
  es tentador. Saber dónde está Carlos convertiría OFFLOAD en una app de control, que es lo
  contrario de este producto. **La cercanía se calcula entre paradas.** Es la regla 5.

## Lo que no puedes romper

- **La sesión se crea `routed`.** Live Captions no funciona con sesiones relayed, y además se
  desconecta si alguien se silencia más de quince segundos. No es un ajuste posterior: si se
  descubre tarde, Mia se queda sorda en mitad de la demo.
- **Mia no emite audio sin que le den la palabra.** El clip se genera en cuanto levanta la mano,
  así que está listo y la tentación de reproducirlo sola es real. Pide la palabra y espera. Es
  la regla 2, y hay un test que la cubre.
- **Marcar a Nicolás es consecuencia de un sí**, nunca de una decisión de Mia.
- **Todo va por JWT**, con Application ID y clave privada. La autenticación básica con API key y
  secreto no soporta webhooks, y aquí todo depende de ellos.
- **Nada de `private.key` en el repositorio.** Ya está en `.gitignore`; que siga así.
