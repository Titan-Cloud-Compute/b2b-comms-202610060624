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
    const row = await (this.db as any).notificationPreference.findUnique({ where: { userId } });
    if (!row) return { userId, ...DEFAULT_PREFS };
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }

  async upsert(
    userId: string,
    input: PutApiNotificationsPreferencesRequestDto,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    const data = { orderAlerts: input.orderAlerts, messageAlerts: input.messageAlerts };
    const row = await (this.db as any).notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }
}
