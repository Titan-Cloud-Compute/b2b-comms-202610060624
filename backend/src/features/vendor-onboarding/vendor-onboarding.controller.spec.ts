/**
 * Unit spec for the vendor-onboarding controller.
 *
 * Pattern: construct the controller with a real VendorOnboardingService backed by
 * a jest-mocked prisma — no HTTP server, no DB.  Guards do not run in direct
 * method calls so auth/role coverage is deliberately omitted here.
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
import type { PrismaService } from '../../prisma/prisma.service';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeHandler(name: string) {
  return (VendorOnboardingController.prototype as Record<string, unknown>)[name] as () => unknown;
}

function fakeReq(userId: string) {
  return { session: { userId } } as unknown as import('express').Request;
}

// ── factory ───────────────────────────────────────────────────────────────────

function makeController() {
  const vendorProfileMock = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  };
  const documentMock = {
    create: jest.fn(),
    findMany: jest.fn(),
  };
  const mockPrisma = {
    vendorProfile: vendorProfileMock,
    document: documentMock,
  } as unknown as PrismaService;

  const service = new VendorOnboardingService(mockPrisma);
  const controller = new VendorOnboardingController(service);
  return { controller, service, vendorProfileMock, documentMock };
}

// ── route metadata ─────────────────────────────────────────────────────────

describe('VendorOnboardingController — route metadata', () => {
  it('controller is mounted at api/vendor', () => {
    expect(Reflect.getMetadata(PATH_METADATA, VendorOnboardingController)).toBe('api/vendor');
  });

  it('POST profile is mounted at "profile" with 201', () => {
    const h = makeHandler('createProfile');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('profile');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(HttpStatus.CREATED);
  });

  it('POST documents is mounted at "documents" with 201', () => {
    const h = makeHandler('createDocument');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('documents');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(HttpStatus.CREATED);
  });

  it('GET documents is mounted at "documents"', () => {
    const h = makeHandler('listDocuments');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('documents');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.GET);
  });
});

// ── POST /api/vendor/profile ──────────────────────────────────────────────

describe('VendorOnboardingController — POST profile', () => {
  const validBody = { companyName: 'ACME Corp', contactEmail: 'cto@acme.example.com' };
  const profileRow = { id: 'vp-1', companyName: 'ACME Corp', contactEmail: 'cto@acme.example.com' };

  it('returns {id, companyName, contactEmail} and upserts with the session userId', async () => {
    const { controller, vendorProfileMock } = makeController();
    vendorProfileMock.upsert.mockResolvedValue({
      ...profileRow,
      userId: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await controller.createProfile(fakeReq('u1'), validBody);
    expect(result).toEqual({ id: 'vp-1', companyName: 'ACME Corp', contactEmail: 'cto@acme.example.com' });
    expect(vendorProfileMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('throws BadRequestException for an invalid contactEmail', async () => {
    const { controller } = makeController();
    await expect(
      controller.createProfile(fakeReq('u1'), { companyName: 'ACME', contactEmail: 'not-an-email' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException for an empty companyName', async () => {
    const { controller } = makeController();
    await expect(
      controller.createProfile(fakeReq('u1'), { companyName: '', contactEmail: 'ok@ok.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException for a missing body', async () => {
    const { controller } = makeController();
    await expect(
      controller.createProfile(fakeReq('u1'), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ── POST /api/vendor/documents ────────────────────────────────────────────

describe('VendorOnboardingController — POST documents', () => {
  const profileRow = { id: 'vp-1', userId: 'u1', companyName: 'ACME Corp', contactEmail: 'cto@acme.example.com', createdAt: new Date(), updatedAt: new Date() };

  it('creates a document with status "pending" and returns {id, filename, status}', async () => {
    const { controller, vendorProfileMock, documentMock } = makeController();
    vendorProfileMock.findUnique.mockResolvedValue(profileRow);
    documentMock.create.mockResolvedValue({
      id: 'doc-1',
      filename: 'compliance.pdf',
      status: 'pending',
      vendorProfileId: 'vp-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await controller.createDocument(fakeReq('u1'), { filename: 'compliance.pdf' });
    expect(result).toEqual({ id: 'doc-1', filename: 'compliance.pdf', status: 'pending' });
    expect(documentMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending', vendorProfileId: 'vp-1' }),
      }),
    );
  });

  it('throws NotFoundException when the caller has no vendor profile', async () => {
    const { controller, vendorProfileMock } = makeController();
    vendorProfileMock.findUnique.mockResolvedValue(null);
    await expect(
      controller.createDocument(fakeReq('u1'), { filename: 'compliance.pdf' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException for an empty filename', async () => {
    const { controller } = makeController();
    await expect(
      controller.createDocument(fakeReq('u1'), { filename: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ── GET /api/vendor/documents ─────────────────────────────────────────────

describe('VendorOnboardingController — GET documents', () => {
  const profileRow = { id: 'vp-1', userId: 'u1', companyName: 'ACME Corp', contactEmail: 'cto@acme.example.com', createdAt: new Date(), updatedAt: new Date() };
  const docRows = [
    { id: 'doc-2', filename: 'cert.pdf', status: 'approved', vendorProfileId: 'vp-1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'doc-1', filename: 'compliance.pdf', status: 'pending', vendorProfileId: 'vp-1', createdAt: new Date(), updatedAt: new Date() },
  ];

  it('returns a list of {id, filename, status} for the caller\'s profile', async () => {
    const { controller, vendorProfileMock, documentMock } = makeController();
    vendorProfileMock.findUnique.mockResolvedValue(profileRow);
    documentMock.findMany.mockResolvedValue(docRows);

    const result = await controller.listDocuments(fakeReq('u1'));
    expect(result).toEqual([
      { id: 'doc-2', filename: 'cert.pdf', status: 'approved' },
      { id: 'doc-1', filename: 'compliance.pdf', status: 'pending' },
    ]);
  });

  it('returns [] when the caller has no vendor profile', async () => {
    const { controller, vendorProfileMock } = makeController();
    vendorProfileMock.findUnique.mockResolvedValue(null);

    const result = await controller.listDocuments(fakeReq('u99'));
    expect(result).toEqual([]);
  });

  it('filters documents to only the caller\'s vendorProfileId', async () => {
    const { controller, vendorProfileMock, documentMock } = makeController();
    vendorProfileMock.findUnique.mockResolvedValue(profileRow);
    documentMock.findMany.mockResolvedValue([docRows[0]]);

    const result = await controller.listDocuments(fakeReq('u1'));
    expect(documentMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorProfileId: 'vp-1' } }),
    );
    expect(result).toHaveLength(1);
  });
});
