import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Configuracion del CLI de Prisma (migraciones, studio, generate).
 *
 * Desde Prisma 7 la URL de conexion no puede vivir en schema.prisma: el CLI la
 * lee de aqui y el cliente de la aplicacion la recibe por su driver adapter
 * (ver src/lib/db.ts). Son dos caminos distintos hacia la misma base de datos.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
