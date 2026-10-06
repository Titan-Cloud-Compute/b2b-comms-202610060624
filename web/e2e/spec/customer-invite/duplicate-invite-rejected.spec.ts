import { test, expect } from '@playwright/test';
import { mockApi, login } from '../_support';
import { customerInviteHandler, newInviteState } from './_invite-mock';

test.use({ serviceWorkers: 'block' });

test('duplicate invite rejected', async ({ page }) => {
  await mockApi(page);
  const state = newInviteState();
  await page.route('**/api/**', customerInviteHandler(state));
  await login(page);
  await page.goto('/#/admin/customers');
  await expect(page.getByTestId('admin-customers-screen')).toBeVisible();

  const invite = async () => {
    await page.getByTestId('customer-invite-email').fill('buyer@corp.example.com');
    const [resp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/admin/customers/invite') && r.request().method() === 'POST'),
      page.getByTestId('customer-invite-submit').click(),
    ]);
    return resp;
  };

  expect((await invite()).status()).toBe(201);
  await expect(page.getByTestId('admin-customers-screen')).toContainText('Invitation sent');

  expect((await invite()).status()).toBe(409);
  await expect(page.getByTestId('admin-customers-screen')).toContainText('Customer already exists');
  expect(state.inviteStatuses).toEqual([201, 409]);
  expect(state.customers).toHaveLength(1);
  await expect(page.getByTestId('customer-list-item')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('the response returns 409 error');
});
