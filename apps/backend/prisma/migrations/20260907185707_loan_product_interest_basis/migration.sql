-- AlterTable
ALTER TABLE "LoanProductVersion" ADD COLUMN     "interestBasis" TEXT NOT NULL DEFAULT 'FINANCED_PRINCIPAL';
