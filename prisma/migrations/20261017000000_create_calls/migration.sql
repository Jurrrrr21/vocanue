-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "vapiCallId" VARCHAR(255) NOT NULL,
    "callerNumber" VARCHAR(64),
    "status" VARCHAR(64),
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "durationSeconds" DOUBLE PRECISION,
    "transcript" TEXT,
    "summary" TEXT,
    "endReason" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Call_vapiCallId_key" ON "Call"("vapiCallId");

-- CreateIndex
CREATE INDEX "Call_createdAt_idx" ON "Call"("createdAt");
