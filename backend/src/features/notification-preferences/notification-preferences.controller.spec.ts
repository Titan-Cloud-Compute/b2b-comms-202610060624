import 'reflect-metadata';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';

function makeService() {
  const rows = new Map<string, any>();
  const prisma: any = {
    notificationPreference: {
      findUnique: jest.fn(async ({ where }: any) => rows.get(where.userId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = rows.get(where.userId);
        const row = existing ? { ...existing, ...update } : { id: 'np-1', ...create };
        rows.set(where.userId, row);
        return row;
      }),
    },
  };
  const service = new NotificationPreferencesService(prisma);
  return { service, prisma, rows };
}

const req = (userId: string) => ({ session: { userId, email: 'u@x.test', role: 'USER' } }) as any;
const handler = (name: string) => (NotificationPreferencesController.prototype as any)[name];

describe('NotificationPreferencesController', () => {
  it('is mounted at api/notifications with GET/PUT preferences', () => {
    expect(Reflect.getMetadata(PATH_METADATA, NotificationPreferencesController)).toBe('api/notifications');
    const put = handler('putApiNotificationsPreferences');
    const get = handler('getApiNotificationsPreferences');
    expect(Reflect.getMetadata(PATH_METADATA, put)).toBe('preferences');
    expect(Reflect.getMetadata(METHOD_METADATA, put)).toBe(RequestMethod.PUT);
    expect(Reflect.getMetadata(PATH_METADATA, get)).toBe('preferences');
    expect(Reflect.getMetadata(METHOD_METADATA, get)).toBe(RequestMethod.GET);
  });

  it('PUT upserts and returns the stored record; GET returns it again', async () => {
    const { service } = makeService();
    const c = new NotificationPreferencesController(service);
    const saved = await c.putApiNotificationsPreferences(req('u1'), { orderAlerts: true, messageAlerts: false });
    expect(saved).toEqual({ userId: 'u1', orderAlerts: true, messageAlerts: false });
    expect(await c.getApiNotificationsPreferences(req('u1'))).toEqual(saved);
  });

  it('stores both alert fields as false', async () => {
    const { service, rows } = makeService();
    const c = new NotificationPreferencesController(service);
    await c.putApiNotificationsPreferences(req('u2'), { orderAlerts: true, messageAlerts: true });
    const saved = await c.putApiNotificationsPreferences(req('u2'), { orderAlerts: false, messageAlerts: false });
    expect(saved).toEqual({ userId: 'u2', orderAlerts: false, messageAlerts: false });
    expect(rows.get('u2')).toMatchObject({ orderAlerts: false, messageAlerts: false });
  });

  it('rejects non-boolean fields', async () => {
    const { service } = makeService();
    const c = new NotificationPreferencesController(service);
    await expect(c.putApiNotificationsPreferences(req('u3'), { orderAlerts: 'yes' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
