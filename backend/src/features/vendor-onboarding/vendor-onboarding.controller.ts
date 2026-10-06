import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { VendorOnboardingService } from './vendor-onboarding.service';

const CreateProfileSchema = z.object({
  companyName: z.string().min(1, 'companyName is required').max(200).transform((s) => s.trim()),
  contactEmail: z.string().email('contactEmail must be a valid email'),
});

const CreateDocumentSchema = z.object({
  filename: z.string().min(1, 'filename is required').max(255).transform((s) => s.trim()),
});

@ApiTags('vendor-onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR, UserRole.ADMIN)
@Controller('api/vendor')
export class VendorOnboardingController {
  constructor(private readonly vendorOnboarding: VendorOnboardingService) {}

  /** POST /api/vendor/profile — upsert the caller's vendor profile; returns 201 with the profile. */
  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(@Req() req: Request, @Body() body: unknown) {
    const result = CreateProfileSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.errors[0]?.message ?? 'invalid request body');
    }
    const userId = req.session!.userId;
    return this.vendorOnboarding.upsertProfile(userId, result.data);
  }

  /** POST /api/vendor/documents — store a compliance document for the caller's vendor profile; returns 201. */
  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  async createDocument(@Req() req: Request, @Body() body: unknown) {
    const result = CreateDocumentSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.errors[0]?.message ?? 'invalid request body');
    }
    const userId = req.session!.userId;
    return this.vendorOnboarding.createDocument(userId, result.data);
  }

  /** GET /api/vendor/documents — list the caller's compliance documents. */
  @Get('documents')
  async listDocuments(@Req() req: Request) {
    const userId = req.session!.userId;
    return this.vendorOnboarding.listDocuments(userId);
  }
}
