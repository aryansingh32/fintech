import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { branchWhereClause } from '../rbac/branch-scope.util';
import { CreateProductDto, CreateProductIdentifierDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto, staff: AuthUser) {
    return this.prisma.product.create({
      data: { ...dto, branchId: staff.branchId ?? undefined },
    });
  }

  async list(staff: AuthUser) {
    return this.prisma.product.findMany({
      where: { ...branchWhereClause(staff), isActive: true },
      include: { identifiers: { where: { status: 'INVENTORY' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Registers a physical unit (a specific phone). The unique constraints on
   * imei1/imei2/serialNumber at the database level are the real protection;
   * this check exists to return a clear error instead of a raw DB error.
   */
  async addIdentifier(productId: string, dto: CreateProductIdentifierDto) {
    if (!dto.imei1 && !dto.imei2 && !dto.serialNumber) {
      throw new BadRequestException('At least one of imei1, imei2, or serialNumber is required.');
    }

    const existing = await this.prisma.productIdentifier.findFirst({
      where: {
        OR: [
          dto.imei1 ? { imei1: dto.imei1 } : undefined,
          dto.imei2 ? { imei2: dto.imei2 } : undefined,
          dto.serialNumber ? { serialNumber: dto.serialNumber } : undefined,
        ].filter(Boolean) as never[],
      },
    });
    if (existing) {
      throw new ConflictException(
        `This device (IMEI/serial) is already registered with status ${existing.status}. It cannot be financed twice.`,
      );
    }

    return this.prisma.productIdentifier.create({
      data: { productId, imei1: dto.imei1, imei2: dto.imei2, serialNumber: dto.serialNumber },
    });
  }

  async findIdentifierAvailableForFinancing(productIdentifierId: string) {
    const identifier = await this.prisma.productIdentifier.findUnique({
      where: { id: productIdentifierId },
      include: { product: true },
    });
    if (!identifier) throw new NotFoundException('Product identifier not found.');
    if (identifier.status !== 'INVENTORY') {
      throw new ConflictException(
        `This unit is not available for financing (current status: ${identifier.status}).`,
      );
    }
    return identifier;
  }

  async searchByIdentifier(query: string) {
    return this.prisma.productIdentifier.findMany({
      where: {
        OR: [
          { imei1: { contains: query } },
          { imei2: { contains: query } },
          { serialNumber: { contains: query } },
        ],
      },
      include: { product: true },
      take: 10,
    });
  }
}
