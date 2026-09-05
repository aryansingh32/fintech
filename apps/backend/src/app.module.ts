import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { RbacModule } from './rbac/rbac.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { LoansModule } from './loans/loans.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { ReportsModule } from './reports/reports.module';
import { SyncModule } from './sync/sync.module';
import { KycModule } from './kyc/kyc.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AccessGuard } from './common/guards/access.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    RbacModule,
    LedgerModule,
    NotificationsModule,
    CustomersModule,
    ProductsModule,
    LoansModule,
    PaymentsModule,
    SupportModule,
    ReportsModule,
    SyncModule,
    KycModule,
    ReceiptsModule,
  ],
  controllers: [AppController],
  providers: [
    // Explicit, ordered global guard chain - every request goes through all
    // three, in this order: rate limit -> authenticate -> authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: AccessGuard },
  ],
})
export class AppModule {}
