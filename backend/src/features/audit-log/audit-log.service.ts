import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiAdminAuditLogResponseDto,
  PostApiAdminAuditLogRequestDto,
  PostApiAdminAuditLogResponseDto,
} from './audit-log.dto';

@Injectable()
export class AuditLogService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['AuditEntry']);
  }

  /** All AuditEntry records, oldest first (chronological order). */
  async list(): Promise<GetApiAdminAuditLogResponseDto[]> {
    const rows = await this.model('AuditEntry').findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(dto: PostApiAdminAuditLogRequestDto): Promise<PostApiAdminAuditLogResponseDto> {
    const row = await this.model('AuditEntry').create({
      data: { action: dto.action, userId: dto.userId },
    });
    return { id: row.id, action: row.action, createdAt: row.createdAt.toISOString() };
  }
}
