import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertProfile(
    userId: string,
    dto: { companyName: string; contactEmail: string },
  ): Promise<{ id: string; companyName: string; contactEmail: string }> {
    const profile = await this.prisma.vendorProfile.upsert({
      where: { userId },
      create: { companyName: dto.companyName, contactEmail: dto.contactEmail, userId },
      update: { companyName: dto.companyName, contactEmail: dto.contactEmail },
    });
    return { id: profile.id, companyName: profile.companyName, contactEmail: profile.contactEmail };
  }

  async createDocument(
    userId: string,
    dto: { filename: string },
  ): Promise<{ id: string; filename: string; status: string }> {
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(
        'Vendor profile not found — submit your company profile first',
      );
    }
    const doc = await this.prisma.document.create({
      data: { filename: dto.filename, status: 'pending', vendorProfileId: profile.id },
    });
    return { id: doc.id, filename: doc.filename, status: doc.status };
  }

  async listDocuments(
    userId: string,
  ): Promise<{ id: string; filename: string; status: string }[]> {
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
    if (!profile) return [];
    const docs = await this.prisma.document.findMany({
      where: { vendorProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({ id: d.id, filename: d.filename, status: d.status }));
  }
}
