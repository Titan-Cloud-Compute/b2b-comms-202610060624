/**
 * Open self-service signup: a token-less signup (after the bootstrap admin)
 * creates a VENDOR account instead of being rejected for a missing token.
 */

import { AuthService } from './auth.service';

function makeService(existingUsers: number) {
  const create = jest.fn().mockImplementation(({ data }) =>
    Promise.resolve({ id: 'u-1', ...data }),
  );
  const tx = {
    user: { count: jest.fn().mockResolvedValue(existingUsers), create },
    registrationToken: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    runAsAdmin: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as ConstructorParameters<typeof AuthService>[0];
  const service = new AuthService(prisma, {} as never, {} as never, {} as never);
  jest.spyOn(service as any, 'issueToken').mockResolvedValue('session-token');
  jest.spyOn(service as any, 'applyModelGrant').mockResolvedValue(undefined);
  return { service, create, tx };
}

describe('AuthService.signup — open vendor signup', () => {
  it('creates a VENDOR account when no registration token is supplied', async () => {
    const { service, create, tx } = makeService(3);
    const { user, token } = await service.signup({
      email: 'New.Vendor@Example.com',
      password: 'Password1!',
    } as never);
    expect(user.role).toBe('VENDOR');
    expect(create.mock.calls[0][0].data.role).toBe('VENDOR');
    expect(create.mock.calls[0][0].data.email).toBe('new.vendor@example.com');
    expect(tx.registrationToken.findUnique).not.toHaveBeenCalled();
    expect(token).toBe('session-token');
  });

  it('still makes the very first (bootstrap) user an ADMIN', async () => {
    const { service } = makeService(0);
    const { user } = await service.signup({
      email: 'first@example.com',
      password: 'Password1!',
    } as never);
    expect(user.role).toBe('ADMIN');
  });

  it('rejects a short password', async () => {
    const { service } = makeService(3);
    await expect(
      service.signup({ email: 'a@example.com', password: 'short' } as never),
    ).rejects.toThrow();
  });
});
