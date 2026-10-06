import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesRequestDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

/** Defaults returned when the user has never saved preferences. */
const DEFAULT_PREFS = { orderAlerts: true, messageAlerts: true };

@Injectable()
export class NotificationPreferencesService extends FeatureService {
  constructor(private readonly db: PrismaService) {
    super(db, []);
  }

  async get(userId: string): Promise<GetApiNotificationsPreferencesResponseDto> {
    // findFirst (not findUnique): the live DB has no unique index on userId.
    const row = await (this.db as any).notificationPreference.findFirst({ where: { userId } });
    if (!row) return { userId, ...DEFAULT_PREFS };
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }

  async upsert(
    userId: string,
    input: PutApiNotificationsPreferencesRequestDto,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    const data = { orderAlerts: input.orderAlerts, messageAlerts: input.messageAlerts };
    // Manual find-then-write: Prisma's native upsert keyed on userId needs a DB
    // unique constraint that the migrations never created.
    const repo = (this.db as any).notificationPreference;
    const existing = await repo.findFirst({ where: { userId } });
    const row = existing
      ? await repo.update({ where: { id: existing.id }, data })
      : await repo.create({ data: { userId, ...data } });
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }
}
