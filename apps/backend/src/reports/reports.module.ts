import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [CustomersModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
