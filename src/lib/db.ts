import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";

/**
 * Prisma 7 connects through a driver adapter instead of its own binary engine,
 * so the connection pool belongs to the Node driver.
 */
function create(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Cached on globalThis because Next reloads server modules on every change in
// development: without it each reload opens a new pool and Postgres starts
// refusing connections halfway through the afternoon.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db = globalForPrisma.prisma ?? create();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
