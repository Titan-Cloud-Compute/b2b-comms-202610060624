import { BadRequestException, ForbiddenException, HttpStatus, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderManagementController } from './order-management.controller';
import { OrderManagementService } from './order-management.service';

function makePrisma() {
  return {
    user: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn(), create: jest.fn() },
    vendorProfile: { findUnique: jest.fn() },
    order: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    orderItem: { createMany: jest.fn() },
  };
}

describe('OrderManagementController', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let controller: OrderManagementController;
  const req = (userId: string, role: string) => ({ session: { userId, role } }) as any;

  beforeEach(() => {
    prisma = makePrisma();
    controller = new OrderManagementController(new OrderManagementService(prisma as unknown as PrismaService));
  });

  it('is mounted at api/orders with role checks', () => {
    expect(Reflect.getMetadata(PATH_METADATA, OrderManagementController)).toBe('api/orders');
    const p = OrderManagementController.prototype;
    expect(Reflect.getMetadata(METHOD_METADATA, p.postApiOrders)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, p.postApiOrders)).toBe(HttpStatus.CREATED);
    expect(Reflect.getMetadata(METHOD_METADATA, p.getApiOrders)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(METHOD_METADATA, p.patchApiOrdersIdConfirm)).toBe(RequestMethod.PATCH);
    expect(Reflect.getMetadata(PATH_METADATA, p.patchApiOrdersIdConfirm)).toBe(':id/confirm');
    expect(Reflect.getMetadata(ROLES_KEY, p.postApiOrders)).toContain('CUSTOMER');
    expect(Reflect.getMetadata(ROLES_KEY, p.patchApiOrdersIdConfirm)).toEqual(['VENDOR', 'ADMIN']);
  });

  it('customer creates a pending order with items', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
    prisma.order.create.mockResolvedValue({ id: 'o1', status: 'pending', customerId: 'c1', vendorId: 'v1' });
    const res = await controller.postApiOrders(req('u1', 'CUSTOMER'), {
      vendorId: 'v1',
      items: [{ description: 'Widget', quantity: 2, unitPrice: 9.5 }],
    });
    expect(res).toEqual({ id: 'o1', status: 'pending', customerId: 'c1', vendorId: 'v1' });
    expect(prisma.order.create).toHaveBeenCalledWith({ data: { status: 'pending', customerId: 'c1', vendorId: 'v1' } });
    expect(prisma.orderItem.createMany).toHaveBeenCalledWith({
      data: [{ description: 'Widget', quantity: 2, unitPrice: 9.5, orderId: 'o1' }],
    });
  });

  it('creates a Customer row when missing', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'buyer@corp.example.com' });
    prisma.customer.create.mockResolvedValue({ id: 'c9' });
    prisma.order.create.mockResolvedValue({ id: 'o2', status: 'pending', customerId: 'c9', vendorId: 'v1' });
    const res = await controller.postApiOrders(req('u1', 'CUSTOMER'), { vendorId: 'v1' });
    expect(res.customerId).toBe('c9');
  });

  it('rejects missing vendorId', async () => {
    await expect(controller.postApiOrders(req('u1', 'CUSTOMER'), {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('customer lists only own orders', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.order.findMany.mockResolvedValue([{ id: 'o1', status: 'confirmed', customerId: 'c1', vendorId: 'v1' }]);
    const res = await controller.getApiOrders(req('u1', 'CUSTOMER'));
    expect(res[0].status).toBe('confirmed');
    expect(prisma.order.findMany.mock.calls[0][0].where).toEqual({ customerId: 'c1' });
  });

  it('vendor confirms a pending order', async () => {
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'v1', userId: 'vu' });
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'pending', vendorId: 'v1' });
    prisma.order.update.mockResolvedValue({ id: 'o1', status: 'confirmed' });
    const res = await controller.patchApiOrdersIdConfirm(req('vu', 'VENDOR'), 'o1', { estimatedDelivery: '2026-11-01' });
    expect(res).toEqual({ id: 'o1', status: 'confirmed', estimatedDelivery: '2026-11-01' });
  });

  it('vendor cannot confirm another vendor order', async () => {
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'v2', userId: 'vu' });
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'pending', vendorId: 'v1' });
    await expect(
      controller.patchApiOrdersIdConfirm(req('vu', 'VENDOR'), 'o1', { estimatedDelivery: '2026-11-01' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires estimatedDelivery', async () => {
    await expect(
      controller.patchApiOrdersIdConfirm(req('vu', 'VENDOR'), 'o1', {} as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
