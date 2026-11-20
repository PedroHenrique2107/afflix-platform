-- CreateEnum
CREATE TYPE "MetricKind" AS ENUM ('VIEWS', 'CLICKS', 'ORDERS', 'COMMISSION');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('MANUAL', 'OFFICIAL_REPORT');

-- CreateTable
CREATE TABLE "PublicationMetric" (
    "id" UUID NOT NULL,
    "publicationId" UUID NOT NULL,
    "kind" "MetricKind" NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "source" "MetricSource" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicationMetric_publicationId_kind_source_observedAt_idx" ON "PublicationMetric"("publicationId", "kind", "source", "observedAt");

-- AddForeignKey
ALTER TABLE "PublicationMetric" ADD CONSTRAINT "PublicationMetric_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Valor nunca negativo e origem nunca em branco (o Prisma não modela CHECK; a api valida o mesmo antes).
ALTER TABLE "PublicationMetric" ADD CONSTRAINT "PublicationMetric_value_check" CHECK ("value" >= 0);
ALTER TABLE "PublicationMetric" ADD CONSTRAINT "PublicationMetric_sourceReference_check" CHECK (length(btrim("sourceReference")) > 0);
