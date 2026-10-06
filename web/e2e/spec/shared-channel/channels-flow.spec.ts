import { test, expect } from '@playwright/test';
import { mockApi, login } from '../_support';

test.use({ serviceWorkers: 'block' });

test('vendor creates a channel and posts a message on /channels', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/channels', async (route) => {
    const method = route.request().method().toUpperCase();
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', name: 'Acme x Corp' }),
    });
  });
  await page.route('**/api/channels/*/messages', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '22222222-2222-4222-8222-222222222222',
        body: 'Hello from Corp',
        channelId: '11111111-1111-4111-8111-111111111111',
      }),
    }),
  );
  await login(page);
  await page.goto('/#/channels');
  await expect(page.getByTestId('channels-screen')).toBeVisible();
  await expect(page.getByTestId('channel-list')).toBeAttached();
  await expect(page.locator('body')).not.toContainText('list of shared communication channels');

  await page.getByTestId('channel-name-input').fill('Acme x Corp');
  await page.getByTestId('create-channel-submit').click();
  await expect(page.getByTestId('channel-item')).toContainText('Acme x Corp');
  await expect(page.getByTestId('channel-created')).toBeVisible();

  await page.getByTestId('message-body-input').fill('Hello from Corp');
  await page.getByTestId('post-message-submit').click();
  await expect(page.getByTestId('message-item')).toContainText('Hello from Corp');
  await expect(page.getByTestId('message-posted')).toBeVisible();
});
