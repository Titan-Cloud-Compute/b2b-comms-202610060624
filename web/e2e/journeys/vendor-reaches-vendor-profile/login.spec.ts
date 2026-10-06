import { test, expect } from '@playwright/test';
import { mockAuthApi } from '../_auth-mock';

test.use({ serviceWorkers: 'block' });

test('vendor reaches vendor profile — login', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/#/login');
  await page.getByLabel('Email').fill('vendor@acme.example.com');
  await page.getByLabel('Password').fill('password');
  await page.locator('app-login').getByRole('button').click();
  await page.waitForURL(/#\/vendor\/profile/);
  await expect(page).toHaveURL(/#\/vendor\/profile/);
});
