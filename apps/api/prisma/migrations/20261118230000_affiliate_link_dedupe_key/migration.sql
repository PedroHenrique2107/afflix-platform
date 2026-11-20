-- AffiliateLink nunca foi gravada antes do SW-2 (não havia endpoint), então NOT NULL não exige backfill.

-- AlterTable
ALTER TABLE "AffiliateLink" ADD COLUMN     "dedupeKey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLink_dedupeKey_key" ON "AffiliateLink"("dedupeKey");
