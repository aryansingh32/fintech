-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffRole" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "StaffRole" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "StaffUser" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByStaffId" TEXT,
ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "chatApprovedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_approvedByStaffId_fkey" FOREIGN KEY ("approvedByStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
