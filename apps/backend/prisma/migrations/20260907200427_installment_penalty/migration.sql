-- AlterEnum
ALTER TYPE "AdjustmentType" ADD VALUE 'PENALTY';

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "penaltyAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
