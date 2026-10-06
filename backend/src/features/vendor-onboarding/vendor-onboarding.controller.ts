import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireUser, RolesGuard } from '../../auth/roles.guard';
import { VendorOnboardingService } from './vendor-onboarding.service';

const ProfileSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  contactEmail: z.string().email(),
});

const DocumentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
});

@ApiTags('vendor-onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireUser()
@Controller('api/vendor')
export class VendorOnboardingController {
  constructor(private readonly service: VendorOnboardingService) {}

  @Post('profile')
  @HttpCode(201)
  async createProfile(@Req() req: Request) {
    const body = (req as Request & { body: unknown }).body;
    const result = ProfileSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.service.upsertProfile(req.session!.userId, result.data);
  }

  @Post('documents')
  @HttpCode(201)
  async createDocument(@Req() req: Request) {
    const body = (req as Request & { body: unknown }).body;
    const result = DocumentSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.service.createDocument(req.session!.userId, result.data);
  }

  @Get('documents')
  async listDocuments(@Req() req: Request) {
    return this.service.listDocuments(req.session!.userId);
  }
}
