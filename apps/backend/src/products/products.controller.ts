import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { ProductsService } from './products.service';
import { CreateProductDto, CreateProductIdentifierDto } from './dto/product.dto';

@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.STAFF)
@RequirePermissions(Permission.PRODUCT_MANAGE)
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.products.create(dto, user);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.products.list(user);
  }

  @Get('identifiers/search')
  searchIdentifiers(@Query('q') query: string) {
    return this.products.searchByIdentifier(query ?? '');
  }

  @Post(':productId/identifiers')
  addIdentifier(@Param('productId') productId: string, @Body() dto: CreateProductIdentifierDto) {
    return this.products.addIdentifier(productId, dto);
  }
}
