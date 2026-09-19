-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Circulo" AS ENUM ('NUCLEO', 'APOYO');

-- CreateTable
CREATE TABLE "notas" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "circulo" "Circulo" NOT NULL,
    "telefono_hash" TEXT NOT NULL,
    "telefono_cola" TEXT NOT NULL,
    "email" TEXT,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_google" (
    "id" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "alcance" TEXT NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_google_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anotaciones" (
    "id" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "lugar" TEXT,
    "evento_google_id" TEXT,
    "run_id" TEXT,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anotaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salas" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificaciones" (
    "id" TEXT NOT NULL,
    "telefono_hash" TEXT NOT NULL,
    "telefono_cola" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "canal" TEXT,
    "persona_id" TEXT,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personas_telefono_hash_key" ON "personas"("telefono_hash");

-- CreateIndex
CREATE UNIQUE INDEX "personas_email_key" ON "personas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_google_persona_id_key" ON "cuentas_google"("persona_id");

-- CreateIndex
CREATE INDEX "anotaciones_persona_id_idx" ON "anotaciones"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_token_key" ON "sesiones"("token");

-- CreateIndex
CREATE INDEX "sesiones_persona_id_idx" ON "sesiones"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "salas_clave_key" ON "salas"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "verificaciones_telefono_hash_key" ON "verificaciones"("telefono_hash");

-- CreateIndex
CREATE UNIQUE INDEX "verificaciones_request_id_key" ON "verificaciones"("request_id");

-- CreateIndex
CREATE INDEX "verificaciones_persona_id_idx" ON "verificaciones"("persona_id");

-- AddForeignKey
ALTER TABLE "cuentas_google" ADD CONSTRAINT "cuentas_google_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anotaciones" ADD CONSTRAINT "anotaciones_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificaciones" ADD CONSTRAINT "verificaciones_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
