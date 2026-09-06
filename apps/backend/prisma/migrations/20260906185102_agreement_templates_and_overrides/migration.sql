-- CreateEnum
CREATE TYPE "AgreementTemplateKey" AS ENUM ('TERMS_OF_SERVICE', 'LOAN_AGREEMENT_DEFAULT');

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "updatedByStaffId" TEXT;

-- CreateTable
CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "key" "AgreementTemplateKey" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgreementTemplate_key_isActive_idx" ON "AgreementTemplate"("key", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementTemplate_key_version_key" ON "AgreementTemplate"("key", "version");

-- AddForeignKey
ALTER TABLE "AgreementTemplate" ADD CONSTRAINT "AgreementTemplate_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_updatedByStaffId_fkey" FOREIGN KEY ("updatedByStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
