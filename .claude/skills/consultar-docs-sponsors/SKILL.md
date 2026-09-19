---
name: consultar-docs-sponsors
description: "Consultar la documentación viva de Mastra, Vonage, Nebius, SLNG, Make o Railway antes de escribir código contra ellas. Se activa siempre que se vaya a proponer una API, un parámetro, un identificador de modelo o una opción de configuración de cualquiera de esas seis plataformas, y también al depurar un error que venga de una de ellas."
---

# Documentación de las plataformas, antes de escribir

## Por qué esta skill existe

Las seis plataformas de OFFLOAD se mueven más rápido que los datos de entrenamiento de cualquier
modelo. Escribir de memoria contra ellas no produce un error que salte al momento: produce
código plausible que falla en la demo.

Tres ejemplos reales, ya documentados por el equipo:

- **La mitad de los ejemplos de Vonage que circulan son de la generación antigua de TokBox.**
  Hablan de «OpenTok API key» y de una API key de proyecto de vídeo en lugar de Application ID.
  Las cuentas nuevas no van por ahí.
- **La documentación de Nebius circula con dos URLs base distintas**, `api.studio.nebius.ai/v1`
  y `api.tokenfactory.nebius.com/v1`, según su antigüedad. Hay que comprobar cuál responde con
  la clave antes de escribir nada alrededor.
- **La API de Mastra ha cambiado de forma hace poco.** Un ejemplo de hace seis meses puede no
  compilar.

## La regla

**Nunca se escribe de memoria contra una de estas plataformas. Siempre hay una vía, y si no la
hubiera, se dice en voz alta en vez de inventar.**

No importa cuál: MCP, CLI, `curl`, WebFetch o un fichero del propio repositorio. Lo que no vale
es dar por buena una firma porque suena bien.

## Cuándo es obligatorio consultar

Antes de escribir la primera línea, no después de que falle:

- Proponer una llamada, un método, un parámetro o una opción de configuración
- Elegir un identificador de modelo
- Depurar un error que devuelve la plataforma
- Afirmar que algo no se puede hacer

**No hace falta** para lo que ya está decidido y escrito en `CLAUDE.md` o en `docs/`. Eso no se
vuelve a consultar: se cita.

## Las vías, por plataforma y por orden

Cada fila tiene al menos dos. Si la primera no responde, se baja a la siguiente; nunca se salta
al final.

| Plataforma | 1ª vía | 2ª vía | 3ª vía |
|---|---|---|---|
| **Mastra** | MCP `mastra` | WebFetch a `mastra.ai/docs` | `npx mastra --help` |
| **Vonage** | MCP `vonage-docs` | `npx @vonage/cli --help` | WebFetch a `developer.vonage.com` |
| **Next.js** | `node_modules/next/dist/docs/` | `npx next --help` | WebFetch a `nextjs.org/docs` |
| **Nebius** | `curl $NEBIUS_BASE_URL/models` | WebFetch a `docs.nebius.com` | — |
| **SLNG** | `curl api.slng.ai/v1/catalog/models` | `docs.slng.ai/llms.txt` | El panel de la cuenta |
| **Railway** | WebFetch a `docs.railway.com` | `npx @railway/cli --help` | — |
| **Make** | MCP `make`, con token propio | WebFetch a `make.com/help` | La propia interfaz de Make |
| **Un paquete npm** | `npm view <paquete>` | `node_modules/<paquete>/README.md` | WebFetch a su repositorio |

Dos comandos que resuelven más de lo que parece y no necesitan ningún MCP:

```bash
# Qué versión existe, qué exporta, qué binarios trae
npm view @vonage/server-sdk version dependencies bin

# El catálogo vivo de Nebius, que es de donde salen los identificadores
curl -H "Authorization: Bearer $NEBIUS_API_KEY" $NEBIUS_BASE_URL/models

# El de SLNG, que además no pide clave: idiomas y regiones de cada modelo
curl "https://api.slng.ai/v1/catalog/models?service_type=tts&language=es"
```

### Si ninguna vía responde

Entonces se dice, y se dice claro:

> «No he podido verificar esta firma con ninguna de las vías. Lo escribo como propuesta, no
> como código bueno: compruébalo en la documentación antes de darlo por válido.»

Una respuesta confiada que está mal cuesta mucho más que una duda dicha a tiempo. Y en una
demo, muchísimo más.

## Los dos MCP, y por qué están así

### Mastra

Va como dependencia de desarrollo fijada a una versión, y `.mcp.json` lo arranca **con `node` y
la ruta del paquete**, no con `npx`. Arranca en unos 600 ms.

Dos intentos fallidos antes de dar con esto, y merece la pena que estén escritos:

- `npx -y @mastra/mcp-docs-server@latest` descarga siete megas en cada arranque de sesión.
  Treinta segundos no le bastan y la conexión caduca.
- `npx mcp-docs-server` con el paquete ya instalado tampoco: en Windows el ejecutable es
  `npx.cmd`, y el servidor se lanza sin shell.

`node node_modules/@mastra/mcp-docs-server/dist/stdio.js` no depende de la resolución de
ejecutables del sistema y funciona igual en Windows, macOS y Linux. Fijar la versión es además
lo que ya decidió la [0002](../../../docs/decisiones/0002-versiones-fijadas-sin-rango.md).

Si algún día hay que actualizarlo: `npm install --save-exact @mastra/mcp-docs-server@<version>`.

### Make

Make tiene servidor MCP oficial, y con él los escenarios se crean e inspeccionan desde la sesión
en vez de a mano en su interfaz. **No está en `.mcp.json` a propósito**: su URL depende de la
zona de la cuenta y exige un token personal, así que puesto ahí sin credenciales fallaría al
arrancar en la sesión de todo el mundo, todos los días.

Quien vaya a construir los escenarios lo añade en su configuración local, con su token, y no lo
sube. Mientras tanto, la guía de `docs/guias/make.md` cubre los cinco escenarios clic a clic.

## Trampas que ya conocemos

Antes de consultar, conviene tener estas presentes, porque son las que hacen perder una tarde.

**Nebius**

- El catálogo se mueve y los checkpoints retirados **no redirigen el tráfico**. La lista viva se
  pide antes de cada tanda: `curl -H "Authorization: Bearer $NEBIUS_API_KEY" $NEBIUS_BASE_URL/models`
- **En Mastra los modelos llevan prefijo `nebius/`. En la API de Token Factory no lo llevan.**
  Es la confusión más frecuente del proyecto.
- Los identificadores de modelo salen del entorno, nunca del código. **Y no como valor por
  defecto tampoco:** el proyecto tuvo `meta-llama/Llama-3.3-70B-Instruct` escrito como reserva en
  `modelo.ts`, Nebius lo retiró, y el chat entero dejó de responder sin que nada avisara hasta
  que alguien pidió una respuesta. Si falta la variable, se falla diciendo qué falta.
  *(Pagado el 2026-09-17.)*
- **Un identificador que está en `/v1/models` no garantiza que responda como hace falta.** Con
  salida estructurada por JSON Schema, los cuatro candidatos medidos el 2026-09-17 contestaron
  bien pero con latencias de 0,6 a 29 segundos, y el que lleva «Flash» en el nombre fue el más
  lento de todos con diferencia. Se mide antes de elegir, y una sola medición no es una medida.
- **La generación de imágenes está documentada pero no existe.** `docs.tokenfactory.nebius.com`
  mantiene una página entera de *Image generation* con endpoint, parámetros y dos modelos,
  `stability-ai/sdxl` y `black-forest-labs/flux-schnell`. Con una clave válida, `/v1/images/generations`
  devuelve `404 {"detail":"Not Found"}`, y también `/v1/images`, `/v1/image/generations` y las bases
  antiguas `api.studio.nebius.ai` y `api.studio.nebius.com`. El catálogo de `/v1/models` son
  veintidós modelos y **todos de texto**. Un `404` y no un `403`: no es cuestión de permisos de la
  cuenta, es que la ruta no está. *(Comprobado contra la API el 2026-09-16.)*
- **`/v1/models` no sirve para saber qué sabe hacer la plataforma, solo qué modelos de texto hay.**
  Una familia entera puede faltar del catálogo y de la API sin que su documentación se entere.

**Vonage**

- **Todo lo que necesita OFFLOAD va por JWT**, con Application ID y clave privada. La
  autenticación básica con API key y secreto **no soporta webhooks**, y aquí todo depende de
  ellos.
- **El vídeo vive en `video.api.vonage.com`, y ningún otro host vale.** `api.opentok.com` devuelve
  `403 No suitable authentication found` a un JWT de aplicación: es de la generación de TokBox y
  solo entiende su autenticación. `api-eu.vonage.com` es de Verify. Esto **invalida los ejemplos
  de Live Captions que circulan**, incluidos los del propio Vonage, que apuntan a
  `api.opentok.com/v2/project/<apiKey>/captions`. *(Comprobado contra la API el 2026-09-18.)*
- **La aplicación puede crear sesiones de vídeo sin declarar la capacidad `video`.** La nuestra
  tiene `network_apis` y `verify`, y `session/create` responde `200`. Mirar la lista de capacidades
  y concluir que falta el vídeo es un falso negativo que cuesta una tarde.
- **El JWT de aplicación va SIN ACL.** Con `acl: { paths: { "/*/video/**": {} } }`, que es lo que
  parece razonable, `session/create` devuelve `401` sin explicar nada. Sin ACL, `200`. El
  `acl: { paths: { "/session/**": {} } }` es cosa del **token de sesión**, no del de aplicación.
- **`tokenGenerate` de `@vonage/jwt` conserva los claims propios** —`scope`, `session_id`,
  `role`—, así que no hace falta firmar RS256 a mano para un token de sala. Tres detalles suyos:
  **`sub` se pasa como claim y nunca por la opción `subject`** (copia las opciones tal cual, y
  dejaría los dos dentro); **quiere el PEM, no la ruta**, al revés que `@vonage/auth`; y **modifica
  el objeto de opciones que recibe**, así que se le pasa un literal nuevo cada vez.
- **Una señal REST a una sesión sin nadie conectado devuelve `404`**, con el cuerpo
  `"No clients are actively connected"`. Es el estado normal fuera de una llamada, no un fallo, y
  tratarlo como error llena el registro de ruido.
- **`initPublisher` no lanza: avisa por callback.** La versión normal devuelve el publicador al
  momento y cuenta los fallos aparte, así que un permiso de cámara denegado **no interrumpe nada**:
  el código sigue, la pantalla dice que estás dentro y no aparece ningún mensaje. Desde fuera
  parece que el navegador «ni llega a pedir permiso». Se usa `initPublisher.promise(...)`, y
  `session.publish` también lleva su callback de error. *(Pagado el 2026-09-18.)*
- **Los errores de Vonage no son `Error`**, son objetos planos con `name` y `message`. Un
  `error instanceof Error` los descarta a todos y deja el motivo real por el camino, que convierte
  «no tienes permiso de cámara» en «algo ha fallado». Los nombres que importan:
  `OT_USER_MEDIA_ACCESS_DENIED`, `OT_NO_DEVICES_FOUND`, `OT_HARDWARE_UNAVAILABLE` (la cámara la
  tiene otra ventana, que es como se ensaya esto) y `OT_NOT_SUPPORTED`.
- **Sin `https` no hay cámara, y el navegador no lo dice.** `localhost` es la única excepción, así
  que probar desde otro equipo por la IP de la red deja la llamada muda sin ningún mensaje y sin
  pedir permiso. Se comprueba `window.isSecureContext` antes de nada, o media hora se va buscando
  el fallo en el código.
- **El SDK no entrega a nadie sus propios subtítulos.** Para que alguien se oiga a sí mismo hay que
  suscribirse a su propio stream, con `audioVolume: 0` y en un elemento que no se engancha al
  documento. Sin eso solo se transcribe lo que dice la otra persona, que es media conversación. Y
  publicar los propios exige `publishCaptions: true` en `initPublisher`, que no viene por defecto.
- **Los subtítulos parciales llegan palabra a palabra.** `captionReceived` trae `caption`,
  `streamId` e `isFinal`; con `partialCaptions: true` la misma frase llega siete veces a medio
  construir. Para pintar sirven; para decidir algo, solo lo que trae `isFinal`.
- **El SDK de navegador es `export =` de CommonJS**, así que el módulo llega envuelto en `default`
  o desnudo según quien lo empaquete. Y pesa: en desarrollo, el `import()` dinámico **se compila la
  primera vez que alguien lo pide** y ese primer intento falla con `Failed to fetch`, funcionando
  al segundo. Se carga al abrir la pantalla, no al pulsar el botón. *(Pagado el 2026-09-18.)*
- Live Captions **solo funciona con sesiones `routed`**: captura el audio del Media Router, así
  que P2P y relayed quedan fuera. La sesión se crea routed desde el principio, no es un ajuste
  posterior.
- **Arrancar los subtítulos exige un token con rol de moderador.** Uno de publicador no puede, y
  el error no lo dice con claridad. *(Verificado en el MCP el 2026-09-14.)*
- Live Captions **se corta solo**: cuatro horas por defecto, mínimo cinco minutos, y termina
  sesenta segundos después de que se desconecte el último cliente. Una sola sesión de subtítulos
  a la vez, y **no es compatible con cifrado de extremo a extremo**.
- Silent Auth tiene que salir por datos móviles, con el wifi apagado. Desde un navegador no hay
  forma de forzarlo. El SMS de respaldo se deja cableado siempre.
- **Con `Test access`, Silent Auth se completa con los `990…` y con líneas reales no.** Se
  reconoce en la capacidad `network_apis` de la aplicación: `network_application_id:
  "test-application"`. Dar de alta un móvil en *Network Registry → Test Numbers → Your Numbers*
  —hasta cinco— sirve para que Vonage devuelva `check_url` y lo intente, pero la operadora
  rechaza con `"The silent auth verification cannot be completed."` mientras el Network
  Application Profile no esté **Accepted** por ella, que es un trámite con plazo. Para
  diagnosticar un número se pide `silent_auth` como **único** canal: el error sale síncrono y no
  se manda ningún SMS.
- **La silenciosa tiene un interruptor propio dentro de la capacidad Network Registry**, en el
  bloque «Some Features require configuration to test», y ahí es donde se declara la URL de
  vuelta (*Number verification Redirect URI*). Que la función salga en la lista de la cuenta no
  significa que la aplicación la tenga activada. Con el interruptor puesto y la URL declarada,
  Orange siguió rechazando igual: era necesario, no suficiente. *(Comprobado el 2026-09-16.)*
- **Ni el webhook de eventos ni la Reports API dicen por qué falla una silenciosa.** El evento
  `failed` trae estado y poco más; `GET api.nexmo.com/v2/reports/records?product=VERIFY-V2&channel=silent_auth`
  —con Basic auth, y la cuenta de prueba sí tiene acceso— devuelve operadora y `FAILED`, sin
  motivo. Cuando un rechazo de operadora no se explica desde nuestro lado, lo que queda es
  preguntar a Vonage con el `request_id`, no seguir probando.
- **El reloj distingue «no sale por datos» de «la operadora dice que no».** Un timeout de treinta
  segundos contra la pasarela es que la petición no salió por la red móvil; un rechazo en uno o
  dos segundos es que sí llegó y la contestaron. Mirar eso antes que el wifi, la VPN o la
  Retransmisión privada ahorra descartarlos de uno en uno. *(Medido el 2026-09-16.)*
- **`"sandbox": true` está retirado y devuelve `422`.** Sigue en media documentación y en varios
  tutoriales oficiales. Lo sustituye el Network Registry Playground con números virtuales que
  empiezan por `990`, y **exige una aplicación de Vonage aparte**: una sola no puede mezclar
  tráfico de pruebas y real. *(Verificado en el MCP el 2026-09-15.)*
- **Desde web sí se puede, con `redirect_url` en el canal `silent_auth`.** La documentación
  insiste en los SDK nativos y da a entender que no hay alternativa. El navegador recorre las
  redirecciones y vuelve con `#request_id=…&code=…` en el fragmento. En el SDK de Node el
  parámetro es **`redirectUrl`** en camelCase y es **obligatorio**, aunque la API lo declare
  opcional. El canal de respaldo también va por enumerado: `Channels.SMS`, no `"sms"`.
- **`/v0.1/identity-insights` con `sim_swap` no es Silent Auth**, es otro producto. Aparece al
  buscar «verificación» y se confunde con facilidad.
- **Desde el 15 de septiembre de 2026, España exige registrar en la CNMC todo Sender ID
  alfanumérico de SMS**, y los no registrados se bloquean. Sin verificar si afecta al remitente
  por defecto de Verify o solo a los alias propios: si un SMS aceptado no llega, mirar ahí
  primero.

**Mastra**

- Los pasos suspendidos y los tiempos de inferencia impredecibles **no encajan en endpoints
  serverless**. Un proceso de larga vida, siempre.
- Mastra recomienda su skill por delante del MCP para el día a día, y el MCP para consultas
  puntuales de API. Si el MCP se nota lento, ese es el motivo.
- **La salida estructurada es `structuredOutput: { schema }` en `agent.generate()`**, y el objeto
  validado llega en `respuesta.object`. No es `output` ni `experimental_output`.
  *(Verificado en `docs/agents/structured-output.md` el 2026-09-17.)*
- **Con Nebius hay que encender `supportsStructuredOutputs: true` en el proveedor**, o la salida
  estructurada no restringe nada. `createOpenAICompatible` asume por defecto que un proveedor
  compatible con OpenAI **no** admite `response_format: json_schema`, así que no lo manda: el
  modelo contesta el JSON que le parece y la validación falla después. Pidiendo `{ tipo: enum }`
  devolvía `{"intention":"event"}` —en inglés y con otro nombre de campo— y fallaban 28 de 30
  frases del banco. Con la opción puesta, 25 de 30 aciertos y **cero fallos de formato**.
  *(Medido el 2026-09-17.)*
- `jsonPromptInjection: "system"` también funciona, y es lo único que funciona sin esa opción, pero
  **no da la misma garantía**: inyecta el esquema en el prompt en lugar de restringir la
  decodificación, así que el modelo puede romperlo y solo se descubre al validar. El proyecto pide
  decodificación restringida, así que la opción del proveedor es la vía buena.

**SLNG**

- **No hay servidor MCP de SLNG que consultar, y el que tiene va al revés.** Sus páginas de MCP
  —`guides/agents/tools-and-mcp/connect-with-mcp`, y los endpoints `…/mcp-servers`— son para que
  **SLNG se conecte como cliente** a servidores MCP de terceros y le dé esas herramientas a un
  agente de voz suyo. No sirven para leer su documentación desde aquí. Lo que sustituye al MCP es
  su catálogo, que responde **sin clave**: `GET api.slng.ai/v1/catalog/models`, con filtros
  `service_type`, `language`, `region`, `provider`, `streaming`, y `page_size` hasta 100 — `limit`
  no existe y devuelve `400`. *(Comprobado contra la API el 2026-09-18.)*
- **Las regiones no se llaman como uno supone.** Las que sirven a Europa son **`eu-west`** y
  `eu-north`; `eu-central` **no existe** en el catálogo, y estuvo escrito en nuestro
  `.env.example` desde el principio. Cada modelo trae `available_regions`, que es lo que hay que
  mirar, y no todos llegan a la UE.
- **Un modelo con español no es un modelo servido desde Europa.** `fish/tts:s2.1-pro` y
  `slng/fish/tts:s2.1-pro` hablan español y **no tienen ninguna región europea**: usarlos manda
  audio de conversaciones fuera de la UE. Con español y en `eu-west` hay siete, entre ellos
  `deepgram/aura:2`, `cartesia/sonic:3.5`, `gradium/tts:default` y `soniox/tts-rt:v1`. Para
  escuchar, `soniox/speech-ai:rt-v5` sí está en `eu-west`. *(Medido el 2026-09-18.)*
- **La clave se genera por proyecto, no por cuenta**, en `app.slng.ai` → Projects → New project →
  Generate key. Se ve **una sola vez**. Viaja como `Authorization: Bearer`, y la misma vale para
  speech, agentes y batch, incluidos los hosts regionales. Los prefijos son `slng_cu_` para
  consumo y `slng_bt_` para batch.
- **La llamada de voz va al host de la región, no a `api.slng.ai`**, y es
  `POST https://eu-west.api.slng.ai/v1/tts/<modelo>` con `Authorization: Bearer` y un cuerpo de
  `{ model, text }`. `model` es la VOZ —`aura-2-estrella-es`—, no el modelo, que ya va en la ruta.
- **Los ajustes de audio que la documentación lista como opcionales los rechaza la ruta de Aura.**
  Mandar `encoding`, `sample_rate` o `container` devuelve `400 Audio settings are not supported for
  this Deepgram Aura route`. Sin ellos responde `200` y el audio sale en WAV PCM de 24 kHz.
- **La cabecera WAV declara 2 GB y eso NO significa que venga cortado.** Es el marcador de tamaño
  desconocido de una respuesta en streaming. Para saber si el audio está entero se miran los
  segundos —`(bytes - 44) / (24000 * 2)`— contra lo que dura la frase, no la cabecera.
  *(Las tres comprobadas el 2026-09-18.)*
- **El catálogo responde `200` con clave y sin ella**, así que un `200` ahí no prueba que una clave
  valga. Para comprobar una clave hay que pedir algo que cueste: una síntesis corta.
- **Que un modelo de dictado esté en el catálogo con español no significa que se pueda llamar por
  HTTP.** `soniox/speech-ai:rt-v5` —lo que este proyecto tenía escrito— es **solo WebSocket**, y eso
  no se ve en la ficha del catálogo: hay que abrir su `docs_url` y mirar si acaba en `-http` o en
  `-ws`. Para un clip grabado sirve `deepgram/nova:3`, que tiene ruta HTTP, español y `eu-west`.
- **El dictado es `POST <region>/v1/stt/<modelo>` con `multipart/form-data`**, campo `audio`, y el
  texto sale en `results.channels[0].alternatives[0].transcript`. `Content-Type` no se escribe a
  mano: lo pone `fetch` con la frontera del multipart, y ponerlo rompe el cuerpo sin decir por qué.
- **Sin `punctuate=true` la transcripción llega sin un solo punto**, en una tirada. Importa más de
  lo que parece cuando lo siguiente que hace el sistema es separar ese texto en cosas sueltas.
  `smart_format=true` también puntúa pero además reescribe «las siete» como «las 7» y toca las
  fechas, que es decidir sobre el contenido antes de que nadie lo haya leído.
  *(Las cuatro medidas contra la API el 2026-09-18.)*
- **El SDK oficial de JavaScript es `voiceai-sdk`, y va por la 0.2.0.** Una API de dos cifras por
  debajo de uno es superficie que puede cambiar de forma entre hackatón y demo: si se usa, se fija
  la versión exacta, que es lo que ya pide la [0002](../../../docs/decisiones/0002-versiones-fijadas-sin-rango.md).

**Railway**

- **El builder rechaza los cache mounts de BuildKit** a menos que el `id` lleve su prefijo:
  `--mount=type=cache,id=s/<serviceId>-<rutaDestino>,target=<ruta>`. Sin `id` dice *«is missing an
  id argument»*; con un `id` cualquiera, *«is missing the cacheKey prefix from its id»*. Y **no
  admite variables ahí**, así que habría que escribir a mano el identificador de un servicio
  concreto dentro del `Dockerfile`. En OFFLOAD se decidió **quitar el cache mount** en vez de atar
  el fichero a una cuenta: lo que se pierde son unos segundos de `npm ci`.
  *(Pagado el 2026-09-17, dos builds fallidos.)*
- **`PORT` lo inyecta Railway y vale 8080**, no 3000. `railway domain --port 3000` deja el servicio
  devolviendo **502** aunque el contenedor arranque bien y los registros no digan nada raro. Se
  arregla con `railway domain update <dominio> --port 8080`, o creando el dominio sin fijar puerto.
- **La región no se elige al crear**: ni `railway init` ni `railway up` la exponen. Se fija después
  y por servicio con `railway scale eu-west=1`, que devuelve la región real —`europe-west4-drams3a`—.
- **Un Postgres nuevo no trae `DATABASE_PUBLIC_URL`**, y la interna `...railway.internal` solo
  resuelve dentro de Railway. Para migrar desde fuera se abre un proxy TCP sobre el 5432, se lanza
  `prisma migrate deploy` y **se borra el proxy al acabar**: mientras vive, la base de datos está
  en internet con la contraseña como única defensa.
- **`tcp-proxy` cambió de forma y ahora es un grupo de subcomandos.** En la 5.49.2,
  `railway tcp-proxy --port 5432` responde `error: unexpected argument '--port' found`. Lo que hay
  es `tcp-proxy create|list|status|delete`, y **el proxy que crea es persistente**: no es un túnel
  que muera al cerrar la terminal, así que olvidarse de `tcp-proxy delete <id> --yes` deja la base
  de datos expuesta indefinidamente. Conviene comprobar con `tcp-proxy list` que queda en cero.
  El host y el puerto salen del `--json` del `create`, en `domain` y `proxyPort`.
  *(Comprobado el 2026-09-18.)*
- **Pero ese JSON los trae anidados bajo `proxy`, no en la raíz:**
  `{ "applicationPort": 5432, "staged": false, "committed": true, "proxy": { "id", "domain", "proxyPort" } }`.
  Leerlos del primer nivel devuelve vacío, y ahí está la trampa de verdad: **cuando te enteras de
  que no has podido leer el identificador, el proxy ya existe.** Un script que aborte en ese punto
  por prudencia deja la base de datos abierta justamente por ser prudente. El borrado no puede
  depender del parseo: si el `id` no sale del JSON, se saca de `tcp-proxy list`, que lo da en texto
  plano. *(Pagado el 2026-09-19, con la base de datos expuesta unos minutos.)*
- **Las credenciales de Postgres están en las variables del servicio `Postgres`**, no en las del
  servicio de la aplicación: `PGUSER`, `PGPASSWORD` y `PGDATABASE`. En el servicio de la aplicación
  solo está `DATABASE_URL`, que apunta a la interna.
- **En Windows, `railway variables --set-from-stdin` llamado desde Node devuelve éxito sin hacer
  nada.** El shim `railway.cmd` no propaga la entrada estándar, y `spawnSync` sale con código 0
  mientras la variable no se crea. Hay que llamarlo desde el shell.

**Google**

- Hay que activar **dos APIs por separado**, Calendar y Tasks. Olvidar la segunda da un error de
  permisos que parece de OAuth y no lo es.
- Cada persona del núcleo tiene que estar en la lista de usuarios de prueba. Una cuenta que no
  esté no puede dar consentimiento, y el error no lo dice con claridad.
- Las listas de Google Tasks **no se comparten**: cada lista pertenece a una cuenta.

## Qué hacer con lo que se aprende

Una trampa descubierta una vez y no escrita se descubre otra vez. Cuando una consulta destape
algo que no estaba aquí:

- Si afecta a una decisión de arquitectura → entra en `CLAUDE.md`
- Si es una trampa de plataforma → entra en esta skill, en la sección de arriba
- Si cambia cómo se pone en marcha algo → entra en la guía de `docs/` que corresponda
