import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController, CustomerProfileController } from './customers.controller';

@Module({
  // CustomerProfileController ('customers/me') MUST be registered before
  // CustomersController - otherwise CustomersController's 'customers/:id'
  // route greedily matches '/customers/me' first.
  controllers: [CustomerProfileController, CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
