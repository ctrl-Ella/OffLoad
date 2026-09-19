import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen de producción mínima: el stage `runner` del Dockerfile copia
  // .next/standalone y arranca `node server.js`, sin node_modules completo.
  // Sin esto, esa carpeta no se genera y la imagen no arranca.
  output: "standalone",

  // En desarrollo, Next bloquea sus propios recursos —la conexión de recarga
  // en caliente, las fuentes— cuando la petición llega desde un dominio
  // distinto al que arrancó el servidor. Por el túnel público eso deja la
  // página pintada pero sin hidratar: los botones no hacen nada. Solo afecta
  // a `next dev`.
  allowedDevOrigins: ["*.ngrok-free.app", "*.trycloudflare.com"],

  // Mastra y Prisma cargan binarios y módulos nativos en tiempo de ejecución.
  // Si el bundler del servidor intenta empaquetarlos, fallan al resolverse.
  // Se dejan fuera del bundle y se cargan como require() normal de Node.
  serverExternalPackages: [
    "@mastra/core",
    "@mastra/memory",
    "@mastra/pg",
    "@mastra/loggers",
    "@prisma/client",
  ],
};

export default nextConfig;
