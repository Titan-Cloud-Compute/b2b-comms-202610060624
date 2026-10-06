import { test, expect } from '@playwright/test';
import { mockApi } from '../../spec/_support';

test.use({ serviceWorkers: 'block' });

test('vendor reaches vendor profile — channels', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/login');
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/(?!login)/, { timeout: 10_000 });
  // setup: vendor-profile step
  await page.goto('/#/vendor/profile');
  await page.getByTestId('vendor-profile-screen').waitFor();
  // slice: channels
  await page.goto('/#/channels');
  await expect(page.getByTestId('channels-screen')).toBeVisible();
});
