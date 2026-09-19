# Despliegue en Railway

Un solo servicio de larga vida y Postgres al lado. Y una regla de calendario que vale más que toda la configuración junta.

---

## La regla: desplegar con el esqueleto vacío, antes del código

Primero la URL, luego lo que va dentro.

El motivo es concreto. Las URLs de webhook de Vonage y de Make se configuran a mano dentro de sus paneles. Si apuntan a un túnel local, cada reinicio cambia el dominio y hay que volver a tocarlas, con el despiste garantizado de que alguien lo olvide justo antes de la demo. Con el dominio de Railway se configuran una vez y no se vuelven a mirar en todo el fin de semana.

Desplegar al final, que es lo que hace todo el mundo, significa reconfigurar webhooks el domingo con prisa.

---

## Cómo se despliega

```bash
railway login
railway init            # crea el proyecto
railway add             # añade Postgres al mismo proyecto
railway up              # sube y construye
```

La imagen sale del [`Dockerfile`](../../Dockerfile) del repositorio: cuatro etapas, usuario sin privilegios y el `standalone` de Next como imagen de ejecución.

---

## Las cinco cosas donde se pierde una tarde

### 1 · La región no se elige al crear

Ni `railway init` ni `railway up` la exponen, aunque parezca que sí. **Se fija después y por servicio:**

```bash
railway scale eu-west=1
```

El comando devuelve la región real —algo como `europe-west4-drams3a`—, y esa respuesta es la comprobación: no se da por buena la región porque se haya escrito el comando, se lee lo que contesta.

No es cosmético. Un producto que lee agendas familiares y transcribe conversaciones de pareja con toda la infraestructura en Europa es una frase que se sostiene sola delante de un jurado. Y encaja con la región europea de SLNG, que es `eu-west` —`eu-central` no existe en su catálogo, por mucho que suene a la que debería ser—.

### 2 · El puerto es 8080, no 3000

Railway inyecta `PORT` y vale **8080**. El proceso ya lo lee, así que aquí no hay nada que cambiar en el código, pero sí al crear el dominio:

```bash
railway domain                                  # sin fijar puerto
railway domain update <dominio> --port 8080     # si ya se creó mal
```

`railway domain --port 3000` deja el servicio devolviendo **502** aunque el contenedor arranque bien y los registros no digan nada raro. Es de los fallos más desorientadores que hay, porque todo parece correcto.

### 3 · Postgres se referencia, no se copia

Se añade al mismo proyecto y Railway expone la cadena como variable de referencia:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Copiar y pegar la cadena en lugar de referenciarla funciona hasta que Railway rota la contraseña, y entonces deja de funcionar sin que nadie haya tocado nada.

### 4 · Las migraciones se lanzan desde fuera, y se cierra la puerta al salir

La imagen de producción es el `standalone` de Next: no lleva la CLI de Prisma ni el esquema, así que las migraciones no se pueden correr desde dentro del contenedor.

Un Postgres nuevo **no trae `DATABASE_PUBLIC_URL`**, y la interna `...railway.internal` solo se resuelve dentro de la red de Railway. Así que hay que abrirle una puerta y cerrarla detrás. Las credenciales están en las variables del servicio `Postgres`, no en las de la aplicación: `PGUSER`, `PGPASSWORD`, `PGDATABASE`.

```bash
railway tcp-proxy create --port 5432 --service Postgres --json   # da domain y proxyPort
DATABASE_URL="postgresql://<PGUSER>:<PGPASSWORD>@<domain>:<proxyPort>/<PGDATABASE>?schema=public" \
  npx prisma migrate deploy
railway tcp-proxy delete <id> --yes --service Postgres
railway tcp-proxy list --service Postgres                        # tiene que quedar en cero
```

**El proxy es persistente, no es un túnel.** No muere al cerrar la terminal: mientras exista, la base de datos está en internet con la contraseña como única defensa. Borrarlo no es limpieza, es la mitad del procedimiento, y por eso la última línea comprueba que no queda ninguno.

La CLI cambió de forma aquí: en la 5.49.2, `railway tcp-proxy --port 5432` responde `error: unexpected argument '--port' found`. Ahora `tcp-proxy` es un grupo con `create`, `list`, `status` y `delete`.

**Y el JSON de `create` trae los datos anidados, no en la raíz:**

```json
{ "applicationPort": 5432, "staged": false, "committed": true, "proxy": { "id": "…", "domain": "…", "proxyPort": 12345 } }
```

Leer `domain` o `proxyPort` del primer nivel devuelve vacío. Y ese fallo tiene una consecuencia que no se ve venir: **cuando descubres que no has podido leer el identificador, el proxy ya está creado.** Un script que aborte ahí por prudencia deja la base de datos abierta precisamente por intentar ser prudente.

Así que el borrado no puede depender de haber leído bien la respuesta. Si el `id` no se extrae del JSON, se saca de `tcp-proxy list`, que lo da en texto plano, y se borra igual. *(Pagado el 2026-09-19: la base de datos estuvo expuesta unos minutos.)*

Meter la migración en el arranque del contenedor es lo correcto cuando hay varias instancias y un despliegue por hora. Con una instancia y un fin de semana, cuesta más de lo que resuelve.

### 5 · La clave privada de Vonage viaja como variable

`private.key` no se sube al repositorio, y el despliegue sale del repositorio. Así que la clave va como variable de entorno y el proceso la escribe a disco al arrancar, porque el SDK quiere una ruta de fichero.

```bash
VONAGE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

**Los `\n` escapados son el detalle que rompe esto.** Una clave pegada sin escapar llega al proceso en una sola línea y el JWT falla con un error de formato que no menciona los saltos de línea por ningún lado.

En local no se toca nada: la clave sigue siendo el fichero descargado del panel.

---

## Nada de adaptadores serverless

El workflow de Mastra se suspende esperando a que una persona conteste, y eso pueden ser minutos u horas. Su propia documentación avisa: los pasos suspendidos y los tiempos de inferencia impredecibles no encajan en endpoints serverless, agotan sockets y superan tiempos de espera.

Railway ejecuta un proceso de larga vida, que es justo lo que hace falta. Solo hay que no estropearlo:

- El arranque es el servidor de Node, nunca un adaptador de funciones
- El proceso escucha en `process.env.PORT`. Un puerto fijo en el código y el servicio no responde
- Nada de estado en memoria: si el proceso se reinicia, lo único que sobrevive es lo que está en Postgres

Ese último punto no es una limitación, es el diseño. El workflow vive en base de datos precisamente para poder reiniciarse sin perder una negociación a medias, y conviene comprobarlo a propósito: se suspende un run, se reinicia el servicio, y el run tiene que reanudarse en el paso exacto.

---

## Un servicio o dos

Para un fin de semana, **uno**. Next.js y Mastra en el mismo proceso: un despliegue, un juego de variables, una URL.

Separarlos es lo correcto en producción y lo recomienda la propia documentación de Mastra, pero duplica la configuración y no resuelve ningún problema a esta escala.

---

## Los registros son la única superficie de depuración

En local está Mastra Studio. En Railway hay registros y nada más.

Cada línea que importe lleva el `runId` delante. Cuando algo se atasca en la demo la pregunta siempre es la misma —en qué paso se quedó ese run— y con el `runId` se responde en un segundo.

```ts
JSON.stringify({ runId, paso: "esperando-a-carlos", estado: "suspendido" });
```

---

## Variables en Railway

Las mismas de `.env.example`, más estas:

```bash
PORT=                       # lo inyecta Railway y vale 8080. No se define
DATABASE_URL=${{Postgres.DATABASE_URL}}
PUBLIC_URL=https://....up.railway.app
VONAGE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

`PUBLIC_URL` pasa a ser el dominio de Railway y deja de ser el del túnel. Ese cambio es el momento de reconfigurar por última vez los webhooks de Vonage y de Make **y la URI de redirección del cliente de Google**, que es la que más se olvida porque no falla hasta el final del todo.

---

## Comprobación después del primer despliegue

Con el esqueleto vacío, antes de escribir producto:

- [ ] El servicio responde en el dominio de Railway
- [ ] `/api/health` responde, que es lo que mira la comprobación de la imagen
- [ ] La región del servicio es europea, **leída de la respuesta de `railway scale`** y no supuesta
- [ ] `npx prisma migrate deploy` ha creado las tablas
- [ ] No queda ningún proxy TCP abierto
- [ ] Un POST de prueba a un endpoint llega y queda en los registros
- [ ] Las URLs de webhook en Vonage y en Make apuntan al dominio de Railway

Cuando pasan todas, la infraestructura deja de ser un riesgo y el resto del fin de semana es producto.
