import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  PostApiVendorProfileRequest,
  PostApiVendorProfileResponse,
  PostApiVendorDocumentsRequest,
  PostApiVendorDocumentsResponse,
  GetApiVendorDocumentsResponse,
} from './vendor-onboarding.types';

@Injectable()
export class VendorOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertProfile(
    userId: string,
    dto: PostApiVendorProfileRequest,
  ): Promise<PostApiVendorProfileResponse> {
    const profile = await this.prisma.vendorProfile.upsert({
      where: { userId },
      create: { companyName: dto.companyName, contactEmail: dto.contactEmail, userId },
      update: { companyName: dto.companyName, contactEmail: dto.contactEmail },
    });
    return { id: profile.id, companyName: profile.companyName, contactEmail: profile.contactEmail };
  }

  async createDocument(
    userId: string,
    dto: PostApiVendorDocumentsRequest,
  ): Promise<PostApiVendorDocumentsResponse> {
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Vendor profile not found — submit your company profile first');
    }
    const doc = await this.prisma.document.create({
      data: { filename: dto.filename, status: 'pending', vendorProfileId: profile.id },
    });
    return { id: doc.id, filename: doc.filename, status: doc.status };
  }

  async listDocuments(userId: string): Promise<GetApiVendorDocumentsResponse[]> {
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
    if (!profile) return [];
    const docs = await this.prisma.document.findMany({
      where: { vendorProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({ id: d.id, filename: d.filename, status: d.status }));
  }
}
