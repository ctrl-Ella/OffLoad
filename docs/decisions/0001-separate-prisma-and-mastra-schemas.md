# 0001 — Separar los schemas de Prisma y de Mastra

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 2026-09-13 |

## Contexto

Mastra crea y mantiene sus propias tablas (hilos, mensajes, trazas del agente). Prisma gobierna
las tablas del negocio mediante migraciones versionadas.

Si ambas viven en el schema `public`, cada `prisma migrate` detecta las tablas de Mastra como
cambios no declarados en el esquema —*drift*— y propone **borrarlas**. Es decir: cada migración
amenazaría con llevarse por delante el historial de conversaciones.

## Decisión

Una sola base de datos, dos schemas con dueño explícito:

- **`public`** — dominio de negocio, gobernado por las migraciones de Prisma.
  La `DATABASE_URL` lleva `?schema=public`, así que Prisma no ve nada más.
- **`mastra`** — todo lo del agente. `PostgresStore` se configura con `schemaName: "mastra"`.

Ambos schemas se crean al inicializar la base de datos, antes de la primera migración.

## Consecuencias

**A favor:** una sola base de datos, un solo contenedor, un solo backup. Cero colisión entre
migraciones. Cada herramienta manda en su terreno.

**En contra:** hay que recordar que existen dos schemas. Una consulta SQL a mano contra `public`
no verá los datos del agente, y eso sorprende la primera vez.

**Si algún día hay que unir datos de ambos** (por ejemplo, relacionar una conversación con un
usuario del negocio), se hace por identificador desde el código, no con un `JOIN` entre schemas:
la frontera existe justamente para que Prisma no gestione lo que no es suyo.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Todo en `public` | Drift en cada migración, con riesgo de borrar los datos del agente |
| Base de datos aparte para Mastra | Un contenedor más y otra cadena de conexión, sin ganar nada real |
| Declarar las tablas de Mastra en `schema.prisma` | Duplicar un esquema que mantiene otra herramienta; se desincroniza a la primera actualización |
