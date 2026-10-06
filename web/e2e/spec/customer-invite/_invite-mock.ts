import type { Route } from '@playwright/test';

export interface InviteMockState {
  customers: { id: string; email: string; userId: string }[];
  inviteStatuses: number[];
}

export function newInviteState(): InviteMockState {
  return { customers: [], inviteStatuses: [] };
}

/**
 * Stateful route handler for the admin session + customer-invite endpoints.
 * Register with page.route AFTER mockApi() so it takes precedence for the paths it handles.
 */
export function customerInviteHandler(state: InviteMockState): (route: Route) => Promise<void> {
  let loggedIn = false;
  const admin = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@b2b-portal.example.com', role: 'ADMIN' };
  return async (route: Route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const path = new URL(req.url()).pathname.replace(/^.*?\/api\//, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'POST' && path === 'auth/login') { loggedIn = true; return json(admin); }
    if (method === 'GET' && path === 'users/me') return loggedIn ? json(admin) : json({ message: 'Unauthorized' }, 401);
    if (method === 'GET' && path === 'admin/customers') {
      return json(state.customers.map(({ id, email }) => ({ id, email })));
    }
    if (method === 'POST' && path === 'admin/customers/invite') {
      const email = String(req.postDataJSON()?.email ?? '').trim().toLowerCase();
      if (state.customers.some(c => c.email === email)) {
        state.inviteStatuses.push(409);
        return json({ statusCode: 409, message: 'Customer already exists' }, 409);
      }
      const n = state.customers.length + 1;
      const customer = {
        id: `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`,
        email,
        userId: `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`,
      };
      state.customers.push(customer);
      state.inviteStatuses.push(201);
      return json({ customerId: customer.id, email, invitationSent: true }, 201);
    }
    return route.fallback();
  };
}
