import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { LoansService } from './loans.service';
import { LoanProductsService } from './loan-products.service';
import { LoansController, LoanProductsController, CustomerLoansController } from './loans.controller';

@Module({
  imports: [CustomersModule],
  // CustomerLoansController ('loans/me', 'loans/me/:id') MUST be registered
  // before LoansController - otherwise LoansController's 'loans/:id' route
  // greedily matches '/loans/me' first (Nest registers routes in this
  // array's order) and a customer request never reaches its own controller.
  controllers: [CustomerLoansController, LoansController, LoanProductsController],
  providers: [LoansService, LoanProductsService],
  exports: [LoansService, LoanProductsService],
})
export class LoansModule {}
