import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import type {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesRequestDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

/**
 * GET/PUT /api/notifications/preferences — the caller's own NotificationPreference.
 * Any authenticated user manages their own record (keyed by session userId).
 */
@ApiTags('notification-preferences')
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationPreferencesController {
  constructor(private readonly notificationpreferences: NotificationPreferencesService) {}

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  async putApiNotificationsPreferences(
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    const userId = (req as any).session?.userId as string;
    const b = (body ?? {}) as Partial<PutApiNotificationsPreferencesRequestDto>;
    if (typeof b.orderAlerts !== 'boolean' || typeof b.messageAlerts !== 'boolean') {
      throw new BadRequestException('orderAlerts and messageAlerts must be booleans');
    }
    return this.notificationpreferences.upsert(userId, {
      orderAlerts: b.orderAlerts,
      messageAlerts: b.messageAlerts,
    });
  }

  @Get('preferences')
  @HttpCode(HttpStatus.OK)
  async getApiNotificationsPreferences(@Req() req: Request): Promise<GetApiNotificationsPreferencesResponseDto> {
    const userId = (req as any).session?.userId as string;
    return this.notificationpreferences.get(userId);
  }
}
