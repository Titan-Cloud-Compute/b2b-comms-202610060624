import { test, expect } from '@playwright/test';
import { mockApi } from '../../spec/_support';

test.use({ serviceWorkers: 'block' });

test('vendor reaches vendor profile — settings-notifications', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/login');
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/(?!login)/, { timeout: 10_000 });
  // setup: vendor-profile step
  await page.goto('/#/vendor/profile');
  await page.getByTestId('vendor-profile-screen').waitFor();
  // setup: channels step
  await page.goto('/#/channels');
  await page.getByTestId('channels-screen').waitFor();
  // setup: invoices step
  await page.goto('/#/invoices');
  await page.getByTestId('invoices-screen').waitFor();
  // slice: settings-notifications
  await page.goto('/#/settings/notifications');
  await expect(page.getByTestId('settings-notifications-screen')).toBeVisible();
});
