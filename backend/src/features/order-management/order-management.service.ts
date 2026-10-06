import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiOrdersResponseDto,
  OrderItemInputDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersResponseDto,
} from './order-management.dto';

export interface OrderActor {
  userId: string;
  role: string;
}

@Injectable()
export class OrderManagementService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Order', 'OrderItem']);
  }

  private async resolveCustomerId(actor: OrderActor): Promise<string> {
    const existing = await this.prisma.customer.findUnique({ where: { userId: actor.userId } });
    if (existing) return existing.id;
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user) throw new ForbiddenException('Unknown user');
    const created = await this.prisma.customer.create({ data: { email: user.email, userId: user.id } });
    return created.id;
  }

  async createOrder(actor: OrderActor, vendorId: unknown, items: unknown): Promise<PostApiOrdersResponseDto> {
    if (typeof vendorId !== 'string' || !vendorId.trim()) {
      throw new BadRequestException('vendorId is required');
    }
    const list = Array.isArray(items) ? (items as OrderItemInputDto[]) : [];
    for (const it of list) {
      if (
        !it ||
        typeof it.description !== 'string' ||
        !Number.isInteger(Number(it.quantity)) ||
        Number(it.quantity) <= 0 ||
        !Number.isFinite(Number(it.unitPrice))
      ) {
        throw new BadRequestException('invalid order item');
      }
    }
    const customerId = await this.resolveCustomerId(actor);
    const order = await this.prisma.order.create({
      data: { status: 'pending', customerId, vendorId: vendorId.trim() },
    });
    if (list.length) {
      await this.prisma.orderItem.createMany({
        data: list.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          orderId: order.id,
        })),
      });
    }
    return { id: order.id, status: order.status, customerId: order.customerId, vendorId: order.vendorId };
  }

  async listOrders(actor: OrderActor): Promise<GetApiOrdersResponseDto[]> {
    let where: Record<string, unknown> = {};
    if (actor.role === 'ADMIN') {
      where = {};
    } else if (actor.role === 'VENDOR') {
      const profile = await this.prisma.vendorProfile.findUnique({ where: { userId: actor.userId } });
      const ids = [actor.userId, ...(profile ? [profile.id] : [])];
      where = { vendorId: { in: ids } };
    } else {
      const customer = await this.prisma.customer.findUnique({ where: { userId: actor.userId } });
      if (!customer) return [];
      where = { customerId: customer.id };
    }
    const orders = await this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' } });
    return orders.map((o) => ({ id: o.id, status: o.status, customerId: o.customerId, vendorId: o.vendorId }));
  }

  async confirmOrder(
    actor: OrderActor,
    id: string,
    estimatedDelivery: unknown,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    if (typeof estimatedDelivery !== 'string' || Number.isNaN(Date.parse(estimatedDelivery))) {
      throw new BadRequestException('estimatedDelivery must be a valid date');
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (actor.role !== 'ADMIN') {
      const profile = await this.prisma.vendorProfile.findUnique({ where: { userId: actor.userId } });
      const ids = [actor.userId, ...(profile ? [profile.id] : [])];
      if (!ids.includes(order.vendorId)) throw new ForbiddenException('Not your order');
    }
    if (order.status !== 'pending') throw new BadRequestException('Only pending orders can be confirmed');
    const updated = await this.prisma.order.update({ where: { id }, data: { status: 'confirmed' } });
    return { id: updated.id, status: updated.status, estimatedDelivery };
  }
}
