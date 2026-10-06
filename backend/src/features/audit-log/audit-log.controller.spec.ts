import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

describe('AuditLogController — /api/admin/audit-log', () => {
  type Row = { id: string; action: string; userId: string; createdAt: Date };
  let rows: Row[];
  let controller: AuditLogController;

  beforeEach(() => {
    rows = [
      { id: 'b', action: 'second', userId: 'u1', createdAt: new Date('2026-01-02T00:00:00Z') },
      { id: 'a', action: 'first', userId: 'u2', createdAt: new Date('2026-01-01T00:00:00Z') },
    ];
    const auditEntry = {
      findMany: async ({ orderBy }: { orderBy: { createdAt: 'asc' | 'desc' } }) =>
        [...rows].sort((x, y) =>
          (x.createdAt.getTime() - y.createdAt.getTime()) * (orderBy.createdAt === 'asc' ? 1 : -1)),
      create: async ({ data }: { data: { action: string; userId: string } }) => {
        const row = { id: 'new', ...data, createdAt: new Date('2026-01-03T00:00:00Z') };
        rows.push(row);
        return row;
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AuditLogService({ auditEntry } as any);
    controller = new AuditLogController(service);
  });

  it('is mounted at api/admin with GET and POST audit-log routes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuditLogController)).toBe('api/admin');
    const get = AuditLogController.prototype.getApiAdminAuditLog;
    const post = AuditLogController.prototype.postApiAdminAuditLog;
    expect(Reflect.getMetadata(PATH_METADATA, get)).toBe('audit-log');
    expect(Reflect.getMetadata(METHOD_METADATA, get)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, post)).toBe('audit-log');
    expect(Reflect.getMetadata(METHOD_METADATA, post)).toBe(RequestMethod.POST);
  });

  it('GET lists AuditEntry records in chronological order', async () => {
    const list = await controller.getApiAdminAuditLog();
    expect(list.map((e) => e.action)).toEqual(['first', 'second']);
    expect(list[0]).toEqual({ id: 'a', action: 'first', userId: 'u2', createdAt: '2026-01-01T00:00:00.000Z' });
  });

  it('POST stores the AuditEntry and returns the created record', async () => {
    const created = await controller.postApiAdminAuditLog({ action: 'login', userId: 'u9' });
    expect(created).toEqual({ id: 'new', action: 'login', createdAt: '2026-01-03T00:00:00.000Z' });
    expect(rows.some((r) => r.action === 'login' && r.userId === 'u9')).toBe(true);
  });

  it('POST rejects a missing action or userId', async () => {
    await expect(controller.postApiAdminAuditLog({ action: '', userId: 'u' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
