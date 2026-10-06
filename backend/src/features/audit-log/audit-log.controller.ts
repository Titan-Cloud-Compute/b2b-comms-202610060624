import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { AuditLogService } from './audit-log.service';
import { PostApiAdminAuditLogRequestDto } from './audit-log.dto';

@ApiTags('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin')
export class AuditLogController {
  constructor(private readonly auditlog: AuditLogService) {}

  /** GET /api/admin/audit-log — AuditEntry records in chronological order. */
  @Get('audit-log')
  async getApiAdminAuditLog() {
    return this.auditlog.list();
  }

  /** POST /api/admin/audit-log — record an AuditEntry; 201 with the created record. */
  @Post('audit-log')
  @HttpCode(HttpStatus.CREATED)
  async postApiAdminAuditLog(@Body() body: PostApiAdminAuditLogRequestDto) {
    const action = typeof body?.action === 'string' ? body.action.trim() : '';
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!action || !userId) {
      throw new BadRequestException('action and userId are required');
    }
    return this.auditlog.create({ action, userId });
  }
}
