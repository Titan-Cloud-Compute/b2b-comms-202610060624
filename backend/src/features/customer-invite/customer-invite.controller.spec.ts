import { ConflictException, BadRequestException, HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { ROLES_KEY } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerInviteController } from './customer-invite.controller';
import { CustomerInviteService } from './customer-invite.service';

type Row = { id: string; email: string; userId?: string; createdAt?: Date };

function fakePrisma() {
  const users: Row[] = [];
  const customers: Row[] = [];
  let seq = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const match = (rows: Row[], where: Record<string, string>) =>
    rows.find(r => Object.entries(where).every(([k, v]) => (r as any)[k] === v)) ?? null;
  return {
    users,
    customers,
    user: {
      findUnique: jest.fn(async ({ where }) => match(users, where)),
      create: jest.fn(async ({ data }) => { const r = { id: id(), ...data }; users.push(r); return r; }),
    },
    customer: {
      findUnique: jest.fn(async ({ where }) => match(customers, where)),
      create: jest.fn(async ({ data }) => { const r = { id: id(), createdAt: new Date(), ...data }; customers.push(r); return r; }),
      findMany: jest.fn(async () => customers.map(c => ({ id: c.id, email: c.email }))),
    },
  };
}

describe('CustomerInviteController', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let controller: CustomerInviteController;

  beforeEach(() => {
    prisma = fakePrisma();
    const service = new CustomerInviteService(prisma as unknown as PrismaService);
    controller = new CustomerInviteController(service);
  });

  it('is mounted at /api/admin/customers and restricted to ADMIN', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CustomerInviteController)).toBe('api/admin/customers');
    expect(Reflect.getMetadata(ROLES_KEY, CustomerInviteController)).toEqual(['ADMIN']);
    const invite = CustomerInviteController.prototype.postApiAdminCustomersInvite;
    expect(Reflect.getMetadata(PATH_METADATA, invite)).toBe('invite');
    expect(Reflect.getMetadata(METHOD_METADATA, invite)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, invite)).toBe(HttpStatus.CREATED);
    const list = CustomerInviteController.prototype.getApiAdminCustomers;
    expect(Reflect.getMetadata(METHOD_METADATA, list)).toBe(RequestMethod.GET);
  });

  it('admin invites customer: creates a Customer record and returns invitationSent true', async () => {
    const res = await controller.postApiAdminCustomersInvite({ email: 'buyer@corp.example.com' });
    expect(res).toEqual({ customerId: expect.any(String), email: 'buyer@corp.example.com', invitationSent: true });
    expect(prisma.customers).toHaveLength(1);
    expect(prisma.customers[0].userId).toBe(prisma.users[0].id);
    expect(await controller.getApiAdminCustomers()).toEqual([{ id: res.customerId, email: 'buyer@corp.example.com' }]);
  });

  it('duplicate invite rejected with 409', async () => {
    await controller.postApiAdminCustomersInvite({ email: 'buyer@corp.example.com' });
    const err = await controller.postApiAdminCustomersInvite({ email: 'Buyer@corp.example.com' }).catch(e => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getStatus()).toBe(409);
    expect(err.message).toMatch(/already exists/i);
    expect(prisma.customers).toHaveLength(1);
  });

  it('rejects an invalid email with 400', async () => {
    await expect(controller.postApiAdminCustomersInvite({ email: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
