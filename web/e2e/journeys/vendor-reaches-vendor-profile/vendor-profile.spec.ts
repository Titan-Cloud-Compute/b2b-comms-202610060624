import { test, expect } from '@playwright/test';
import { mockApi } from '../../spec/_support';

test.use({ serviceWorkers: 'block' });

test('vendor reaches vendor profile — vendor-profile', async ({ page }) => {
  // setup: mock api, log in
  await mockApi(page);
  await page.goto('/#/login');
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/(?!login)/, { timeout: 10_000 });
  // slice: navigate to vendor profile and verify screen is rendered
  await page.goto('/#/vendor/profile');
  await expect(page.getByTestId('vendor-profile-screen')).toBeVisible();
});
