# Make · guía paso a paso

Esta parte del proyecto se construye entera arrastrando cajas en una pantalla, sin escribir código. Si es la primera vez con Make, esta guía va desde cero.

Son cinco escenarios. El primero se explica clic a clic, porque enseña el patrón. Los otros cuatro son el mismo patrón con módulos distintos, así que van más rápido.

---

## Qué es Make, en dos frases

Make es un lienzo donde se conectan cajas. Cada caja hace una cosa pequeña, recibe datos de la caja anterior y se los pasa a la siguiente.

Eso es todo. No hay más concepto detrás.

### Cinco palabras que vas a ver todo el rato

**Escenario** · un flujo completo, de la primera caja a la última. Nosotras vamos a construir cinco.

**Módulo** · cada caja. El primero siempre es el que dispara, y los demás son acciones.

**Conexión** · el permiso para que Make entre en una cuenta tuya. Se da una vez por servicio y se reutiliza.

**Webhook** · una dirección web que Make te regala. Cuando la aplicación llama a esa dirección, el escenario arranca. Es como un timbre.

**Bundle** · un paquete de datos que viaja de una caja a la siguiente. Si ves "1 bundle" es que pasó un dato; si ves "4 bundles" es que pasaron cuatro.

---

## Paso 0 · La cuenta y las conexiones

Antes de construir nada.

1. Crear cuenta en **make.com**, plan gratuito. Mil operaciones al mes, que sobran.
2. En el menú de la izquierda hay una sección de **Connections**. Ahí se autorizan las cuentas una sola vez.

Hay que conectar tres cosas:

- [ ] La cuenta de Google de **Carlos**, para Tasks y Calendar
- [ ] La cuenta de Google de **Elvia**, para Calendar
- [ ] **Telegram**, para los avisos a la familia

**Sobre las cuentas de Google, algo que confunde:** que Carlos haya dado permiso dentro de OFFLOAD no vale aquí. Make pide su propio permiso, aparte. Hay que volver a conectarlo, y son dos minutos.

**Sobre Telegram:** se habla con `@BotFather` dentro de Telegram, se escribe `/newbot`, se le pone nombre, y devuelve un token largo. Ese token es lo que Make pide. Después se crea un grupo de familia y se mete al bot dentro. Cinco minutos en total.

---

## Escenario 1 · Aviso al grupo

**Este es el primero porque es el más simple: dos cajas.** En veinte minutos está hecho y con él ya se entiende el patrón entero.

**Qué hace:** cuando un conflicto queda resuelto, avisa al grupo de la familia.

### Paso a paso

**1.** En la lista de escenarios, botón de crear uno nuevo. Ponle nombre: `OFFLOAD · aviso al grupo`.

**2.** Aparece un círculo grande con un signo de más en el centro. Ese es el primer módulo. Púlsalo.

**3.** En el buscador que sale, escribe `webhook` y elige **Webhooks · Custom webhook**.

**4.** Te pide un webhook. Pulsa **Add**, ponle nombre `aviso`, y guarda.

**5.** Make te muestra una dirección larga que empieza por `https://hook.eu2.make.com/...`. **Cópiala y pásasela al equipo ahora mismo**, antes de seguir. Es lo primero que necesitan, porque sin ella la aplicación no puede llamar a este escenario.

**6.** Ahora viene el paso que más se atasca. Pulsa el botón de **Run once**, abajo a la izquierda. El escenario se queda esperando, con un mensaje de que está escuchando.

**7.** Pídele al equipo que mande el payload de prueba. Es este:

```json
{
  "resumen": "Nicolás lleva al niño a la piscina el jueves a las 19:00",
  "quienResolvio": "Elvia"
}
```

**Tiene que venir completo, con los dos campos.** Make aprende la forma de los datos de ese primer envío, y lo que no llegue ahí no aparecerá luego para conectarlo.

**8.** En cuanto llega, el módulo se pone con un globito encima que dice "1". Púlsalo y verás los datos que llegaron. Si ves ahí `resumen` y `quienResolvio`, va bien.

**9.** Pasa el ratón por el borde derecho del módulo y sale un semicírculo. Arrástralo hacia fuera y suéltalo: aparece el buscador otra vez. Escribe `telegram` y elige **Telegram Bot · Send a Text Message or a Reply**.

**10.** Te pedirá la conexión. Si ya la hiciste en el paso 0, sale en la lista.

**11.** En el campo **Chat ID** va el identificador del grupo. Y en **Text** es donde ocurre lo interesante: al pulsar dentro del campo se abre un panel con etiquetas de colores. Esas etiquetas son los datos que llegaron por el webhook. **Pulsa sobre `resumen` y se inserta solo.** No se escribe a mano, se pulsa.

**12.** Guarda con el icono del disquete.

**13.** Vuelve a pulsar **Run once** y pide otro envío de prueba. Si el mensaje aparece en el grupo de Telegram, funciona.

**14.** Último paso y el que más se olvida: **abajo a la izquierda hay un interruptor que pone ON y OFF.** Mientras esté en OFF, el escenario solo funciona cuando tú pulsas Run once. Ponlo en ON.

### Ya sabes el patrón

Crear, webhook, copiar la URL, Run once, recibir el payload, arrastrar módulos, conectar campos pulsando etiquetas, guardar, probar, encender.

Los cuatro que quedan son lo mismo con otras cajas.

---

## Escenario 2 · Compra a tareas

**Qué hace:** cuando Mia cierra una decisión de cena, deja la lista de la compra en las tareas de quien cocina. Es el que cierra la demo.

**Nombre:** `OFFLOAD · compra a tareas`

**Payload de prueba**
```json
{
  "paraQuien": "carlos",
  "cuando": "2026-09-16",
  "platos": ["pollo al ast", "patatas fritas"],
  "ingredientes": ["pollo", "patatas", "aceite", "sal"]
}
```

**Las cajas, en orden**

1. **Webhooks · Custom webhook** · nombre `compra`
2. **Google Tasks · Search Task Lists** · con la conexión de Carlos. Esto busca si ya existe una lista llamada "Compra".
3. **Flow Control · Router** · esta caja parte el camino en dos ramas
   - Rama A, si no encontró la lista: **Google Tasks · Create a Task List** con el nombre "Compra"
   - Rama B, si la encontró: no hace nada, sigue
4. **Flow Control · Iterator** · aquí se le indica el campo `ingredientes`
5. **Google Tasks · Create a Task** · el título es el ingrediente y la fecha es `cuando`

**Lo que hay que entender del Iterator**, que es lo único nuevo: le llega una lista de cuatro ingredientes y la parte en cuatro paquetes. A partir de esa caja, todo lo que venga detrás se ejecuta cuatro veces, una por ingrediente. Por eso el último módulo crea cuatro tareas sin que haya que repetirlo.

Cuando pruebes, el módulo del Iterator mostrará "4 bundles". Eso es que va bien.

**Cómo sabes que está terminado:** abres Google Tasks en el móvil de Carlos y están los cuatro ingredientes con la fecha de la cena.

---

## Escenario 3 · Resumen del viernes

**Qué hace:** los viernes por la tarde pide a la aplicación el resumen de la semana y lo manda al grupo.

**Nombre:** `OFFLOAD · resumen del viernes`

Este no lleva webhook. El primer módulo es un horario.

**Las cajas**

1. En vez de un webhook, pulsa el **icono del reloj** en la parte de abajo y elige **Every week**, viernes, 18:00
2. **HTTP · Make a request** · método GET, URL `$PUBLIC_URL/api/resumen/semana`. El equipo te dará la dirección exacta.
3. **Telegram · Send a Text Message** · con lo que devolvió la aplicación

**Para la demo no se espera al viernes.** Con el botón de Run once se lanza cuando quieras.

---

## Escenario 4 · Agendas que cambian fuera

**Qué hace:** si alguien mueve una cita en su Google Calendar desde fuera de OFFLOAD, avisa a la aplicación para que recalcule. Es lo que hace que la app parezca despierta.

**Nombre:** `OFFLOAD · agenda de Elvia`

**Las cajas**

1. **Google Calendar · Watch Events** · con la conexión de Elvia. Este módulo vigila el calendario y se dispara solo cuando algo cambia.
2. **HTTP · Make a request** · método POST a `$PUBLIC_URL/api/agenda/cambio`, mandando el evento

Después se duplica el escenario entero (hay una opción de clonar) y en la copia se cambia la conexión a la de Carlos.

**Cómo se comprueba:** mueves una cita a mano en Google Calendar y la aplicación se entera sin que nadie toque nada.

---

## Escenario 5 · Recordatorios encadenados

**El último y el único con truco**, porque Make no sabe esperar horas dentro de un escenario. Se resuelve partiéndolo en dos que se hablan por un almacén de datos.

**Primero, el almacén.** En el menú de la izquierda, sección **Data stores**, crear uno llamado `recordatorios` con estos campos: `personaId` texto, `evento` texto, `avisarA` fecha, `enviado` booleano.

### 5a · Guardar

**Nombre:** `OFFLOAD · guardar recordatorio`

1. **Webhooks · Custom webhook** · nombre `recordatorios`
2. **Data store · Add a record** · guardando `personaId`, `evento`, `avisarA`, y `enviado` en falso

Por cada evento se guardan dos registros: uno para una hora antes y otro para quince minutos antes. Eso lo manda la aplicación ya calculado.

### 5b · Enviar

**Nombre:** `OFFLOAD · enviar recordatorios`

1. **Icono del reloj** · cada 15 minutos
2. **Data store · Search records** · los que tengan `enviado` en falso y `avisarA` ya pasado
3. **Telegram · Send a Text Message** · solo a quien se comprometió, nunca al grupo
4. **Data store · Update a record** · poner `enviado` en verdadero

**El paso 4 no es opcional.** Si se olvida, el mismo recordatorio sale cada quince minutos para siempre. En mitad de una demo eso se ve muchísimo.

Y este es el único escenario que conviene dejar en OFF cuando no se esté probando, porque al correr cada quince minutos consume operaciones sin parar.

---

## Lo que confunde al principio

**El escenario no hace nada aunque esté guardado.** Guardar y encender son cosas distintas. El interruptor de ON está abajo a la izquierda, y hasta que no está en ON solo funciona con Run once.

**Run once se queda esperando y parece colgado.** No está colgado: está escuchando. Se queda así hasta que alguien llama al webhook desde fuera.

**Los campos no se escriben, se pulsan.** Cuando quieras meter un dato que vino del paso anterior, pulsa dentro del campo y elige la etiqueta de color del panel que se abre. Si lo escribes a mano, Make lo trata como texto literal y no como dato.

**Si falta un campo en el panel de etiquetas** es porque el primer payload de prueba no lo traía. Se arregla volviendo al módulo del webhook, borrando la estructura de datos aprendida, y repitiendo con un payload completo.

**Cuando algo falla, la pestaña de History lo cuenta.** Cada ejecución queda guardada con lo que entró y lo que salió en cada caja. Es el sitio donde mirar antes de preguntar.

**El plan gratuito cuenta operaciones, no escenarios.** Cada caja que se ejecuta suma una. Con cinco escenarios probando un fin de semana no se llega ni de lejos a mil, siempre que el de recordatorios no se quede encendido toda la noche.

---

## Qué entregas al equipo

Tres direcciones de webhook, en cuanto las tengas y sin esperar a terminar los escenarios:

```
MAKE_WEBHOOK_AVISO=
MAKE_WEBHOOK_COMPRA=
MAKE_WEBHOOK_RECORDATORIOS=
```

El del resumen y el de agendas no llevan webhook, así que de esos no hay nada que entregar.

---

## Orden y tiempos

| # | Escenario | Cajas | Tiempo |
|---|---|---|---|
| 1 | Aviso al grupo | 2 | 20 min, incluye aprender el patrón |
| 2 | Compra a tareas | 5 | 40 min |
| 3 | Resumen del viernes | 3 | 15 min |
| 4 | Agendas que cambian | 2, por duplicado | 20 min |
| 5 | Recordatorios | 2 escenarios y un almacén | 45 min |

Cada uno se termina, se prueba y se enciende antes de empezar el siguiente. Si el tiempo se acaba, los tres primeros ya sostienen la demo.
