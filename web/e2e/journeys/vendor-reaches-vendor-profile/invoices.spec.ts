import { test, expect } from '@playwright/test';
import { mockApi } from '../../spec/_support';

test.use({ serviceWorkers: 'block' });

test('vendor reaches vendor profile — invoices', async ({ page }) => {
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
  // slice: invoices
  await page.goto('/#/invoices');
  await expect(page.getByTestId('invoices-screen')).toBeVisible();
});
