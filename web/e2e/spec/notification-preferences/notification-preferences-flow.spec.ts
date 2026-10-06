import { test, expect } from '@playwright/test';
import { mockApi, login } from '../_support';

test.use({ serviceWorkers: 'block' });

test('notification preferences: GET, toggle, PUT, reload shows stored values', async ({ page }) => {
  await mockApi(page);
  let stored = { userId: '1', orderAlerts: true, messageAlerts: true };
  const puts: unknown[] = [];
  // Registered after mockApi so it takes precedence for this endpoint.
  await page.route('**/api/notifications/preferences', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      const body = req.postDataJSON();
      puts.push(body);
      stored = { ...stored, orderAlerts: body.orderAlerts, messageAlerts: body.messageAlerts };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stored) });
  });

  await login(page);
  await page.goto('/#/settings/notifications');
  await expect(page.getByTestId('settings-notifications-screen')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('notification preference controls');

  const order = page.getByTestId('pref-order-alerts');
  const message = page.getByTestId('pref-message-alerts');
  await expect(order).toBeChecked();
  await expect(message).toBeChecked();

  await order.uncheck();
  await message.uncheck();
  await page.getByTestId('pref-save').click();

  await expect(page.getByTestId('pref-saved')).toBeVisible();
  await expect(page.getByTestId('pref-saved-all-off')).toBeVisible();
  expect(puts).toEqual([{ orderAlerts: false, messageAlerts: false }]);

  await page.reload();
  await expect(page.getByTestId('settings-notifications-screen')).toBeVisible();
  await expect(page.getByTestId('pref-order-alerts')).not.toBeChecked();
  await expect(page.getByTestId('pref-message-alerts')).not.toBeChecked();
});
