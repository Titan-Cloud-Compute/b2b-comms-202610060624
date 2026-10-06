import { test, expect } from '@playwright/test';
import { mockApi, login } from '../_support';
import { customerInviteHandler, newInviteState } from './_invite-mock';

test.use({ serviceWorkers: 'block' });

test('admin invites customer', async ({ page }) => {
  await mockApi(page);
  const state = newInviteState();
  await page.route('**/api/**', customerInviteHandler(state));
  await login(page);
  await page.goto('/#/admin/customers');
  const screen = page.getByTestId('admin-customers-screen');
  await expect(screen).toBeVisible();
  await expect(page.getByTestId('customer-list')).toBeVisible();
  await expect(page.getByTestId('customer-invite-email')).toHaveAttribute('type', 'email');

  await page.getByTestId('customer-invite-email').fill('buyer@corp.example.com');
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/admin/customers/invite') && r.request().method() === 'POST'),
    page.getByTestId('customer-invite-submit').click(),
  ]);
  expect(resp.status()).toBe(201);
  expect(await resp.json()).toMatchObject({ email: 'buyer@corp.example.com', invitationSent: true });
  expect(state.customers).toHaveLength(1);

  await expect(screen).toContainText('Invitation sent');
  await expect(page.getByTestId('customer-list')).toContainText('buyer@corp.example.com');
  await expect(page.locator('body')).not.toContainText('a Customer record is created and returns 201');
});
