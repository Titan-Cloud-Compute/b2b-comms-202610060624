import { test, expect } from '@playwright/test';
import { mockAuthApi } from '../_auth-mock';

test.use({ serviceWorkers: 'block' });

test('customer reaches orders — login', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/#/login');
  await page.getByLabel('Email').fill('buyer@corp.example.com');
  await page.getByLabel('Password').fill('password');
  await page.locator('app-login').getByRole('button').click();
  await page.waitForURL(/#\/orders/);
  await expect(page).toHaveURL(/#\/orders/);
});
