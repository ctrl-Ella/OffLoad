---
name: automatizaciones
description: "Carril de Make: los cinco escenarios, sus webhooks, el almacén de datos de recordatorios y las conexiones con Google Tasks, Calendar y Telegram. Úsalo para montar, depurar o documentar cualquier automatización, y para los endpoints de la aplicación que Make llama."
---

# Automatizaciones · Make

## Tu carril

Los efectos secundarios de una decisión **ya tomada**. Cinco escenarios:

| Escenario | Se dispara cuando | Qué deja hecho |
|---|---|---|
| Aviso al grupo | Un conflicto pasa a resuelto | El mensaje al grupo de la familia |
| Compra a tareas | Mia cierra una decisión de cena | Un ítem por ingrediente en las tareas de quien cocina |
| Resumen del viernes | Programado, viernes por la tarde | Pide el balance de la semana y lo entrega |
| Agendas que cambian fuera | Google avisa de un cambio | Le dice a OFFLOAD que recalcule los choques |
| Recordatorios encadenados | Se crea un evento con responsable | Aviso a una hora y a quince minutos, solo a quien se comprometió |

También tuyos: los endpoints de la aplicación que Make llama, y las variables
`MAKE_WEBHOOK_*` del entorno.

La guía clic a clic está en `docs/guias/make.md`. El primer escenario se explica entero porque
enseña el patrón; los otros cuatro son lo mismo con otras cajas.

## Documentación

Make publica MCP oficial, pero **no está en `.mcp.json`** porque depende de la zona de la cuenta
y exige token personal. Quien monte los escenarios lo añade en su configuración local con su
token, y no lo sube. El motivo largo está en la skill `consultar-docs-sponsors`.

## Lo que no te toca

**Razonar ni decidir a quién se le pide qué.** Cuando un escenario arranca, la decisión ya está
tomada.

**La frontera con Mastra**, que es la regla que evita pisarse: si Mia necesita el resultado para
seguir razonando o para enseñar algo en pantalla ahora, es una tool de Mastra. Si es una
consecuencia que puede ocurrir un minuto más tarde, es Make.

## Lo que no puedes romper

- **Guardar y encender son cosas distintas.** Un escenario guardado y en OFF solo funciona con
  Run once. El interruptor está abajo a la izquierda.
- **El paso que marca un recordatorio como enviado no es opcional.** Sin él, el mismo aviso sale
  cada quince minutos para siempre, y en mitad de una demo eso se ve muchísimo.
- **Los recordatorios se dejan en OFF cuando no se esté probando.** Corre cada quince minutos y
  consume operaciones sin parar.
- **Los recordatorios van solo a quien se comprometió.** Ni al grupo ni a los demás.
- **El primer payload de prueba tiene que venir completo.** Make aprende la forma de los datos de
  ese envío, y lo que no llegue ahí no aparece luego para conectarlo.
