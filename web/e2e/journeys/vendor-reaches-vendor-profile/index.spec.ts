import { test, expect } from '@playwright/test';
import { mockApi } from '../../spec/_support';

test.use({ serviceWorkers: 'block' });

test('vendor reaches vendor profile — index', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/login');
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/(?!login)/, { timeout: 10_000 });
  // verify each journey screen is reachable
  await page.goto('/#/vendor/profile');
  await expect(page.getByTestId('vendor-profile-screen')).toBeVisible();
  await page.goto('/#/channels');
  await expect(page.getByTestId('channels-screen')).toBeVisible();
  await page.goto('/#/invoices');
  await expect(page.getByTestId('invoices-screen')).toBeVisible();
  await page.goto('/#/settings/notifications');
  await expect(page.getByTestId('settings-notifications-screen')).toBeVisible();
});
