/**
 * Open self-service signup: a non-bootstrap signup WITHOUT a registration
 * token must succeed and create a VENDOR account (no token lookup/claim).
 */

import { AuthService } from './auth.service';

function makeService(existingUsers: number) {
  const create = jest
    .fn()
    .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'u-1', ...data }),
    );
  const count = jest.fn().mockResolvedValue(existingUsers);
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const tx = {
    user: { count, create },
    registrationToken: { findUnique, updateMany },
  };
  const prisma = {
    runAsAdmin: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as ConstructorParameters<typeof AuthService>[0];
  const jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
  const service = new AuthService(prisma, jwt as never, {} as never, {} as never);
  return { service, create, findUnique, updateMany };
}

describe('AuthService.signup — open self-service signup', () => {
  it('creates a VENDOR account when no registration token is supplied', async () => {
    const { service, create, findUnique, updateMany } = makeService(3);

    const { user, token } = await service.signup({
      email: 'New.Vendor@Example.com',
      password: 'Password1!',
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      email: 'new.vendor@example.com',
      role: 'VENDOR',
    });
    expect(user.role).toBe('VENDOR');
    expect(token).toBe('jwt-token');
    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('still makes the very first (bootstrap) user an ADMIN', async () => {
    const { service, create } = makeService(0);

    await service.signup({ email: 'first@example.com', password: 'Password1!' });

    expect(create.mock.calls[0][0].data).toMatchObject({ role: 'ADMIN' });
  });

  it('rejects a short password', async () => {
    const { service } = makeService(3);
    await expect(
      service.signup({ email: 'a@example.com', password: 'short' }),
    ).rejects.toThrow();
  });
});
