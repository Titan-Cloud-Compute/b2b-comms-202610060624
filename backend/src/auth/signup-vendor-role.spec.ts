/**
 * Open self-service signup: every token-less signup creates a VENDOR account;
 * no self-service signup can ever produce an ADMIN.
 * Also asserts that a supplied unknown token is rejected with BadRequestException.
 */

import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

function makeService(existingUsers: number, tokenRow: object | null = null) {
  const create = jest.fn().mockImplementation(({ data }) =>
    Promise.resolve({ id: 'u-1', ...data }),
  );
  const findUnique = jest.fn().mockResolvedValue(tokenRow);
  const tx = {
    user: { count: jest.fn().mockResolvedValue(existingUsers), create },
    registrationToken: { findUnique, updateMany: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    runAsAdmin: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as ConstructorParameters<typeof AuthService>[0];
  const service = new AuthService(prisma, {} as never, {} as never, {} as never);
  jest.spyOn(service as any, 'issueToken').mockResolvedValue('session-token');
  jest.spyOn(service as any, 'applyModelGrant').mockResolvedValue(undefined);
  return { service, create, tx, findUnique };
}

describe('AuthService.signup — open vendor signup', () => {
  it('creates a VENDOR account when no registration token is supplied (count=1)', async () => {
    const { service, create, tx } = makeService(1);
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

  it('creates a VENDOR account even when the store is empty (no bootstrap admin)', async () => {
    const { service } = makeService(0);
    const { user } = await service.signup({
      email: 'first@example.com',
      password: 'Password1!',
    } as never);
    expect(user.role).toBe('VENDOR');
  });

  it('rejects an unknown registration token with BadRequestException', async () => {
    // tokenRow = null → findUnique returns null → invalid token
    const { service } = makeService(1, null);
    await expect(
      service.signup({
        email: 'vendor@example.com',
        password: 'Password1!',
        registrationToken: 'unknown-token-abc123',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });
});
