import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: { name: 'Main Branch', code: 'MAIN' },
  });

  const ownerMobile = process.env.SEED_OWNER_MOBILE ?? '9999999999';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!';

  const owner = await prisma.staffUser.upsert({
    where: { mobile: ownerMobile },
    update: {},
    create: {
      branchId: branch.id,
      name: 'Owner',
      mobile: ownerMobile,
      passwordHash: await argon2.hash(ownerPassword),
      role: 'OWNER',
      isGlobal: true,
    },
  });

  // Root super-admin account, provisioned only when configured via env (kept
  // out of source control - see apps/backend/.env / .env.example). Skipped
  // silently if not configured, so this seed script stays safe to run in any
  // environment (CI, a fresh dev clone) without accidentally creating an
  // account with a default/guessable password.
  if (process.env.SEED_SUPERADMIN_MOBILE && process.env.SEED_SUPERADMIN_PASSWORD) {
    await prisma.staffUser.upsert({
      where: { mobile: process.env.SEED_SUPERADMIN_MOBILE },
      update: {},
      create: {
        branchId: branch.id,
        name: process.env.SEED_SUPERADMIN_NAME ?? 'Super Admin',
        mobile: process.env.SEED_SUPERADMIN_MOBILE,
        email: process.env.SEED_SUPERADMIN_EMAIL,
        passwordHash: await argon2.hash(process.env.SEED_SUPERADMIN_PASSWORD),
        role: 'SUPER_ADMIN',
        isGlobal: true,
        isApproved: true,
      },
    });
  }

  const loanProduct = await prisma.loanProduct.upsert({
    where: { id: 'seed-zero-cost-plan' },
    update: {},
    create: {
      id: 'seed-zero-cost-plan',
      name: 'Zero Cost EMI',
      description: 'No interest, no fees - principal spread evenly across installments.',
    },
  });

  const existingVersion = await prisma.loanProductVersion.findFirst({
    where: { loanProductId: loanProduct.id },
  });
  if (!existingVersion) {
    await prisma.loanProductVersion.create({
      data: {
        loanProductId: loanProduct.id,
        versionNumber: 1,
        interestType: 'ZERO_COST',
        minInstallments: 1,
        maxInstallments: 12,
        installmentFrequency: 'MONTHLY',
        feeRules: [],
        gracePeriodDays: 3,
        latePaymentRules: { penaltyType: 'FLAT', amount: 100 },
        partialPaymentRules: { allowed: true, minAmount: 100 },
        prepaymentRules: { allowed: true, chargePercent: 0 },
        earlyClosureRules: { allowed: true, chargePercent: 0 },
        settlementRules: { requiresApprovalRole: 'OWNER' },
        waiverRules: { requiresApprovalRole: 'OWNER', maxWaiverPercent: 10 },
        reversalRules: { requiresApprovalRole: 'MANAGER' },
      },
    });
  }

  console.log(`Seeded branch "${branch.name}" and owner account (${ownerMobile}).`);
  console.log(`Owner password: ${ownerPassword} (change this immediately in a real deployment).`);
  console.log(`Owner staffUserId: ${owner.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
