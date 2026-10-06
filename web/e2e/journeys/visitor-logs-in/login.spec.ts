import { test, expect } from '@playwright/test';
import { mockAuthApi } from '../_auth-mock';

test.use({ serviceWorkers: 'block' });

test('visitor logs in — login', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/#/login');
  await page.getByLabel('Email').fill('admin@b2b-portal.example.com');
  await page.getByLabel('Password').fill('password');
  await page.locator('app-login').getByRole('button').click();
  await page.getByTestId('admin-customers-screen').waitFor();
  await expect(page).toHaveURL(/#\/admin\/customers/);
});
