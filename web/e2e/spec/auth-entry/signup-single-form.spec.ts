import { test, expect } from '@playwright/test';
import { mockAuthApi } from '../../journeys/_auth-mock';

test.use({ serviceWorkers: 'block' });

test('signup is a single Email + Password form', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/#/signup');
  const form = page.locator('app-signup form');
  await expect(form.locator('input')).toHaveCount(2);
  await expect(page.locator('app-signup label[for="email"]')).toBeVisible();
  await expect(page.locator('app-signup label[for="password"]')).toBeVisible();
  await expect(
    page.locator('app-signup #signupToken, app-signup #signupModel, app-signup #viberPhone, app-signup #whatsappPhone'),
  ).toHaveCount(0);
  await expect(form.getByRole('button')).toHaveCount(1);
});

test('signup creates the account and continues to /vendor/profile', async ({ page }) => {
  await mockAuthApi(page);
  const email = `regress-${Date.now()}@example.com`;
  await page.goto('/#/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password1!');
  const req = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('auth/signup'));
  await page.locator('app-signup').getByRole('button').click();
  expect((await req).postDataJSON()).toEqual({ email, password: 'Password1!' });
  await page.getByText('Account created').waitFor();
  await page.waitForURL(/#\/vendor\/profile/);
});

test('signup shows an alert for an already registered email', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/#/signup');
  await page.getByLabel('Email').fill('vendor@acme.example.com');
  await page.getByLabel('Password').fill('Password1!');
  await page.locator('app-signup').getByRole('button').click();
  await expect(page.locator('app-signup [role="alert"]')).toBeVisible();
  await expect(page.getByText('Account created')).toHaveCount(0);
});
