/**
 * _auth-mock.ts — hermetic auth API mock for the auth-entry journeys
 * (signup / login). Mirrors the backend contract:
 *  - POST auth/signup  → open self-service signup, new accounts are VENDOR
 *  - POST auth/login   → seeded demo accounts (password "password")
 *  - GET  users/me     → the signed-in user, else 401
 */
import type { Page } from '@playwright/test';

export const DEMO_ACCOUNTS: Record<string, string> = {
  'admin@b2b-portal.example.com': 'ADMIN',
  'vendor@acme.example.com': 'VENDOR',
  'buyer@corp.example.com': 'CUSTOMER',
};

export async function mockAuthApi(page: Page): Promise<void> {
  let user: { id: string; email: string; role: string } | null = null;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const apiPath = new URL(req.url()).pathname
      .replace(/^.*\/api\//, '').replace(/^\//, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const body = (() => {
      try { return req.postDataJSON() ?? {}; } catch { return {}; }
    })() as { email?: string; password?: string };

    if (method === 'POST' && apiPath === 'auth/signup') {
      user = { id: 'new-1', email: String(body.email ?? ''), role: 'VENDOR' };
      return json(user, 201);
    }
    if (method === 'POST' && apiPath === 'auth/login') {
      const email = String(body.email ?? '').toLowerCase();
      const role = DEMO_ACCOUNTS[email];
      if (!role || body.password !== 'password') {
        return json({ message: 'invalid credentials' }, 401);
      }
      user = { id: `demo-${role.toLowerCase()}`, email, role };
      return json(user);
    }
    if (method === 'GET' && (apiPath === 'users/me' || apiPath === 'auth/me')) {
      return user ? json(user) : json({ message: 'Unauthorized' }, 401);
    }
    if (method === 'GET') return json([]);
    return json({ ok: true });
  });
}
