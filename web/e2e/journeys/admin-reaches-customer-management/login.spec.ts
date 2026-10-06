import { test, expect } from '@playwright/test';
import { mockAuthApi } from '../_auth-mock';

test.use({ serviceWorkers: 'block' });

test('admin reaches customer management — login', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/#/login');
  await page.getByLabel('Email').fill('admin@b2b-portal.example.com');
  await page.getByLabel('Password').fill('password');
  await page.locator('app-login').getByRole('button').click();
  await page.waitForURL(/#\/admin\/customers/);
  await expect(page.getByTestId('admin-customers-screen')).toBeVisible();
});
