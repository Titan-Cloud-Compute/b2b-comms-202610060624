import { test, expect } from '@playwright/test';
import { mockAuthApi } from '../../journeys/_auth-mock';

test.use({ serviceWorkers: 'block' });

const CASES: Array<{ email: string; url: RegExp }> = [
  { email: 'admin@b2b-portal.example.com', url: /#\/admin\/customers/ },
  { email: 'vendor@acme.example.com', url: /#\/vendor\/profile/ },
  { email: 'buyer@corp.example.com', url: /#\/orders/ },
];

for (const c of CASES) {
  test(`login redirects ${c.email} by role`, async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/#/login');
    await page.getByLabel('Email').fill(c.email);
    await page.getByLabel('Password').fill('password');
    await page.locator('app-login').getByRole('button').first().click();
    await page.waitForURL(c.url);
    await expect(page).toHaveURL(c.url);
  });
}

test('no alert before submit; failed login is announced with role="alert"', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/#/login');
  await expect(page.locator('app-login [role="alert"]')).toHaveCount(0);
  await page.getByLabel('Email').fill('admin@b2b-portal.example.com');
  await page.getByLabel('Password').fill('wrong-password');
  await page.locator('app-login').getByRole('button').first().click();
  await expect(page.locator('app-login [role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/#\/login/);
});
