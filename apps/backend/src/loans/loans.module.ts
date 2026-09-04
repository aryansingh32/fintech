import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { LoansService } from './loans.service';
import { LoanProductsService } from './loan-products.service';
import { LoansController, LoanProductsController } from './loans.controller';

@Module({
  imports: [CustomersModule],
  controllers: [LoansController, LoanProductsController],
  providers: [LoansService, LoanProductsService],
  exports: [LoansService, LoanProductsService],
})
export class LoansModule {}
