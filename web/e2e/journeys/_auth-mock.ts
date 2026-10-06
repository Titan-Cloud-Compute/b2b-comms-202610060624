/**
 * Hermetic auth backend for the auth-entry journeys: mirrors POST auth/login
 * and POST auth/signup with the seeded demo users (password "password").
 */
import type { Page } from '@playwright/test';

export const SEEDED_USERS: Record<string, string> = {
  'admin@b2b-portal.example.com': 'ADMIN',
  'vendor@acme.example.com': 'VENDOR',
  'buyer@corp.example.com': 'CUSTOMER',
};

export async function mockAuthApi(page: Page): Promise<void> {
  let user: { id: string; email: string; role: string } | null = null;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const apiPath = new URL(req.url()).pathname.replace(/^.*\/api\//, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const body = (() => { try { return req.postDataJSON() ?? {}; } catch { return {}; } })();

    if (method === 'POST' && apiPath === 'auth/login') {
      const email = String(body.email ?? '').toLowerCase();
      const role = SEEDED_USERS[email];
      if (!role || body.password !== 'password') {
        return json({ message: 'invalid credentials' }, 401);
      }
      user = { id: email, email, role };
      return json(user);
    }
    if (method === 'POST' && apiPath === 'auth/signup') {
      const email = String(body.email ?? '').toLowerCase();
      if (SEEDED_USERS[email]) return json({ message: 'email already registered' }, 409);
      user = { id: email, email, role: 'VENDOR' };
      return json(user, 201);
    }
    if (method === 'GET' && apiPath === 'users/me') {
      return user ? json(user) : json({ message: 'Unauthorized' }, 401);
    }
    if (method === 'GET') return json([]);
    return json({ ok: true });
  });
}
