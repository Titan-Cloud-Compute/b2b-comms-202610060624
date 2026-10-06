import { test, expect } from '@playwright/test';
import { mockAuthApi } from '../_auth-mock';

test.use({ serviceWorkers: 'block' });

test('visitor signs up — signup', async ({ page }) => {
  await mockAuthApi(page);
  const freshEmail = `vendor-${Date.now()}@example.com`;
  await page.goto('/#/signup');
  await page.getByLabel('Email').fill(freshEmail);
  await page.getByLabel('Password').fill('Password1!');
  const signupRequest = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('auth/signup'),
  );
  await page.locator('app-signup').getByRole('button').click();
  const req = await signupRequest;
  expect(req.postDataJSON()).toMatchObject({ email: freshEmail, password: 'Password1!' });
  await page.getByText('Account created').waitFor();
  await page.waitForURL(/#\/vendor\/profile/);
});
