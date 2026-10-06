/**
 * Vendor-onboarding controller unit spec.
 *
 * Verifies:
 *  - Route metadata (path, method, HTTP status code)
 *  - POST /api/vendor/profile → 201, {id, companyName, contactEmail}
 *  - POST /api/vendor/documents → 201, {id, filename, status:'pending'}
 *  - GET /api/vendor/documents → [{id, filename, status}]
 *  - Invalid bodies → BadRequestException (400)
 *  - Missing vendor profile → NotFoundException
 */
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  RequestMethod,
} from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { VendorOnboardingController } from './vendor-onboarding.controller';
import { VendorOnboardingService } from './vendor-onboarding.service';

const PROFILE_ROW = { id: 'vp1', companyName: 'Acme Corp', contactEmail: 'contact@acme.com', userId: 'u1', createdAt: new Date(), updatedAt: new Date() };
const DOC_ROW = { id: 'd1', filename: 'compliance.pdf', status: 'pending', vendorProfileId: 'vp1', createdAt: new Date(), updatedAt: new Date() };

function makePrisma(profileRow: typeof PROFILE_ROW | null = PROFILE_ROW) {
  return {
    vendorProfile: {
      upsert: jest.fn().mockResolvedValue(profileRow ?? PROFILE_ROW),
      findUnique: jest.fn().mockResolvedValue(profileRow),
    },
    document: {
      create: jest.fn().mockResolvedValue(DOC_ROW),
      findMany: jest.fn().mockResolvedValue([DOC_ROW]),
    },
  };
}

function makeController(prisma: ReturnType<typeof makePrisma> = makePrisma()) {
  const service = new VendorOnboardingService(prisma as never);
  const controller = new VendorOnboardingController(service);
  return { controller, prisma };
}

function makeReq(userId: string, body: unknown) {
  return { session: { userId, role: 'VENDOR', firmId: null }, body } as never;
}

const handler = (name: string) => (VendorOnboardingController.prototype as never as Record<string, unknown>)[name] as object;

describe('VendorOnboardingController', () => {
  // ── Metadata ────────────────────────────────────────────────────────────────

  it('controller path is api/vendor', () => {
    expect(Reflect.getMetadata(PATH_METADATA, VendorOnboardingController)).toBe('api/vendor');
  });

  it('createProfile is POST profile with 201', () => {
    const h = handler('createProfile');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('profile');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(HttpStatus.CREATED);
  });

  it('createDocument is POST documents with 201', () => {
    const h = handler('createDocument');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('documents');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(HttpStatus.CREATED);
  });

  it('listDocuments is GET documents', () => {
    const h = handler('listDocuments');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('documents');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.GET);
  });

  // ── createProfile ────────────────────────────────────────────────────────────

  it('createProfile with valid body returns {id, companyName, contactEmail}', async () => {
    const { controller, prisma } = makeController();
    const req = makeReq('u1', { companyName: 'Acme Corp', contactEmail: 'contact@acme.com' });
    const result = await controller.createProfile(req);
    expect(result).toEqual({ id: 'vp1', companyName: 'Acme Corp', contactEmail: 'contact@acme.com' });
    expect(prisma.vendorProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        create: expect.objectContaining({ userId: 'u1', companyName: 'Acme Corp', contactEmail: 'contact@acme.com' }),
      }),
    );
  });

  it('createProfile with invalid contactEmail throws BadRequestException', async () => {
    const { controller } = makeController();
    const req = makeReq('u1', { companyName: 'Acme', contactEmail: 'not-an-email' });
    await expect(controller.createProfile(req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createProfile with empty companyName throws BadRequestException', async () => {
    const { controller } = makeController();
    const req = makeReq('u1', { companyName: '', contactEmail: 'valid@example.com' });
    await expect(controller.createProfile(req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createProfile with whitespace-only companyName throws BadRequestException', async () => {
    const { controller } = makeController();
    const req = makeReq('u1', { companyName: '   ', contactEmail: 'valid@example.com' });
    await expect(controller.createProfile(req)).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── createDocument ───────────────────────────────────────────────────────────

  it('createDocument with valid body returns {id, filename, status:pending}', async () => {
    const { controller } = makeController();
    const req = makeReq('u1', { filename: 'compliance.pdf' });
    const result = await controller.createDocument(req);
    expect(result).toEqual({ id: 'd1', filename: 'compliance.pdf', status: 'pending' });
  });

  it('createDocument passes callers vendorProfileId to prisma', async () => {
    const { controller, prisma } = makeController();
    const req = makeReq('u1', { filename: 'doc.pdf' });
    await controller.createDocument(req);
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendorProfileId: 'vp1', status: 'pending' }),
      }),
    );
  });

  it('createDocument with no vendor profile throws NotFoundException', async () => {
    const prisma = makePrisma(null);
    const { controller } = makeController(prisma);
    const req = makeReq('u1', { filename: 'doc.pdf' });
    await expect(controller.createDocument(req)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createDocument with empty filename throws BadRequestException', async () => {
    const { controller } = makeController();
    const req = makeReq('u1', { filename: '' });
    await expect(controller.createDocument(req)).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── listDocuments ─────────────────────────────────────────────────────────────

  it('listDocuments returns [{id, filename, status}] mapped from prisma rows', async () => {
    const { controller } = makeController();
    const req = makeReq('u1', {});
    const result = await controller.listDocuments(req);
    expect(result).toEqual([{ id: 'd1', filename: 'compliance.pdf', status: 'pending' }]);
  });

  it('listDocuments returns [] when no vendor profile exists', async () => {
    const prisma = makePrisma(null);
    const { controller } = makeController(prisma);
    const req = makeReq('u1', {});
    const result = await controller.listDocuments(req);
    expect(result).toEqual([]);
  });
});
