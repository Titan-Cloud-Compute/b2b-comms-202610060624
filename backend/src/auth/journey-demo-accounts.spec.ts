// eslint-disable-next-line @typescript-eslint/no-require-imports
const { JOURNEY_DEMO_ACCOUNTS, withJourneyDemoAccounts } = require('../../prisma/seed/journey-demo-accounts');

describe('journey demo accounts (seed)', () => {
  it('pins the three auth-entry journey accounts with role and password "password"', () => {
    const byEmail = Object.fromEntries(
      JOURNEY_DEMO_ACCOUNTS.map((a: { email: string; role: string; password: string }) => [a.email, a]),
    );
    expect(Object.keys(byEmail).sort()).toEqual([
      'admin@b2b-portal.example.com',
      'buyer@corp.example.com',
      'vendor@acme.example.com',
    ]);
    expect(byEmail['admin@b2b-portal.example.com'].role).toBe('ADMIN');
    expect(byEmail['vendor@acme.example.com'].role).toBe('VENDOR');
    expect(byEmail['buyer@corp.example.com'].role).toBe('CUSTOMER');
    for (const a of JOURNEY_DEMO_ACCOUNTS) expect(a.password).toBe('password');
  });

  it('adds missing demo accounts without mutating the input', () => {
    const input = [{ email: 'user@demo.local', password: 'x', role: 'USER' }];
    const out = withJourneyDemoAccounts(input);
    expect(input).toHaveLength(1);
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(input[0]);
  });

  it('does not override an account that is already present', () => {
    const existing = { email: 'vendor@acme.example.com', password: 'secret', role: 'VENDOR' };
    const out = withJourneyDemoAccounts([existing]);
    expect(out.filter((a: { email: string }) => a.email === existing.email)).toEqual([existing]);
    expect(out).toHaveLength(3);
  });

  it('treats a non-array input as empty', () => {
    expect(withJourneyDemoAccounts(undefined)).toHaveLength(3);
  });
});
