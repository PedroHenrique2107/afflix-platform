-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "affiliateLinkId" UUID,
ADD COLUMN     "cta" TEXT;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "AffiliateLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
