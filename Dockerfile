# syntax=docker/dockerfile:1

# Versión exacta, no `22-alpine`: esa etiqueta se mueve, y la decisión 0002 dice
# que en este proyecto nada flota. Coincide con el Node de la máquina de
# desarrollo, así que el runtime es el mismo dentro y fuera del contenedor.
ARG NODE_VERSION=22.23.2-alpine

# --- dependencias -----------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# SIN cache mount de npm, y es una decisión, no un descuido.
#
# El builder de Railway exige que el id lleve su prefijo —`s/<serviceId>-<ruta>`—
# y no admite variables ahí: habría que escribir a mano el identificador de un
# servicio concreto de una cuenta concreta. Esta misma imagen se construye
# también en local y el fichero viaja en un repositorio público, así que ese
# número sería una bomba de relojería: el día que se recree el servicio, el
# build falla con un error que no menciona la causa.
#
# Lo que se pierde es la caché entre builds de `npm ci`. Unos segundos.
RUN npm ci

# --- desarrollo (la imagen que se usa para trabajar en local) ----------------
FROM node:${NODE_VERSION} AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- build de produccion ----------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# URL de relleno SOLO para el build: la validación de entorno corre al importar
# los módulos y el build no debe depender de la base de datos real ni de
# secretos. En ejecución manda la DATABASE_URL que inyecta el entorno.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate && npm run build

# --- ejecucion de produccion ------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# usuario sin privilegios: un proceso comprometido no debería ser root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
# El puerto lo inyecta la plataforma: Railway define PORT y un valor fijo en el
# código deja el servicio sin responder. Aquí solo va el valor por defecto.
ENV PORT=3000 HOSTNAME=0.0.0.0

# Hoy comprueba que el proceso responde, y nada más: `/api/health` todavía no
# consulta Postgres. Cuando lo haga, esta sonda pasa a cazar también el caso de
# aplicación viva con la base de datos caída, sin tocar nada de aquí.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
