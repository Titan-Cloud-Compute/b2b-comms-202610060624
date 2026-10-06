/**
 * Open self-service signup: a non-bootstrap signup WITHOUT a registration
 * token must succeed and create a VENDOR account (no token lookup/claim).
 * No call to POST /api/auth/signup can ever produce an ADMIN.
 */

import { BadRequestException, ConflictException, HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

interface UserStore {
  [email: string]: { id: string; email: string; passwordHash: string; role: string; name?: string };
}

function makeService(initialStore: UserStore = {}) {
  const store = { ...initialStore };

  const create = jest
    .fn()
    .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      const email = data['email'] as string;
      if (store[email]) {
        const err = new Error('Unique constraint failed on the fields: (`email`)');
        throw err;
      }
      const user = { id: 'u-' + Object.keys(store).length, ...data } as UserStore[string];
      store[email] = user;
      return Promise.resolve(user);
    });
  const count = jest.fn().mockImplementation(() => Promise.resolve(Object.keys(store).length));
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const update = jest.fn();

  const tx = {
    user: { count, create, findUnique: jest.fn(), update: jest.fn() },
    registrationToken: { findUnique, updateMany, update },
  };
  const prisma = {
    runAsAdmin: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as ConstructorParameters<typeof AuthService>[0];

  const jwt = { signAsync: jest.fn().mockResolvedValue('tok') };
  const service = new AuthService(
    prisma,
    jwt as never,
    {} as never,
    {} as never,
  );
  return { service, create, findUnique, updateMany, count, jwt };
}

describe('AuthService.signup — open self-service signup', () => {
  // (a) empty store → VENDOR (proves no bootstrap admin)
  it('creates a VENDOR account on an EMPTY store (no bootstrap admin)', async () => {
    const { service, create, findUnique, updateMany } = makeService({});

    const { user, token } = await service.signup({
      email: 'New@Example.com',
      password: 'Password1!',
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      email: 'new@example.com',
      role: 'VENDOR',
    });
    expect(user.role).toBe('VENDOR');
    expect(user.email).toBe('new@example.com');
    expect(token).toBe('tok');
    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  // (b) non-empty store → VENDOR
  it('creates a VENDOR account when no registration token is supplied (non-empty store)', async () => {
    const existing: UserStore = {
      'existing@example.com': {
        id: 'u-0',
        email: 'existing@example.com',
        passwordHash: 'hash',
        role: 'VENDOR',
      },
    };
    const { service, create, findUnique, updateMany } = makeService(existing);

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
    expect(token).toBe('tok');
    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  // (c) duplicate email → ConflictException
  it('rejects a duplicate email with ConflictException', async () => {
    const existing: UserStore = {
      'taken@example.com': {
        id: 'u-0',
        email: 'taken@example.com',
        passwordHash: 'hash',
        role: 'VENDOR',
      },
    };
    const { service } = makeService(existing);

    await expect(
      service.signup({ email: 'taken@example.com', password: 'Password1!' }),
    ).rejects.toThrow(ConflictException);
  });

  // (d) short password → BadRequestException
  it('rejects a short password with BadRequestException', async () => {
    const { service } = makeService({});

    await expect(
      service.signup({ email: 'a@example.com', password: 'short' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('AuthController.signup — route contract', () => {
  // (e) controller delivers {id, email, role:'VENDOR'} and correct metadata
  it('returns {id, email, role:VENDOR} and has HTTP 201 + PATH signup metadata', async () => {
    const { service } = makeService({});

    const cookieFn = jest.fn();
    const fakeRes = { cookie: cookieFn } as unknown as import('express').Response;

    const controller = new AuthController(service);
    const body = await (controller as any).signup(
      { email: 'vendor@example.com', password: 'Password1!' },
      fakeRes,
    );

    expect(body).toMatchObject({ email: 'vendor@example.com', role: 'VENDOR' });
    expect(typeof body.id).toBe('string');
    expect(cookieFn).toHaveBeenCalled();

    // Reflect metadata: method-level PATH and HTTP_CODE
    const handler = (AuthController.prototype as any)['signup'];
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('signup');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(HttpStatus.CREATED);

    // Class-level PATH
    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('api/auth');
  });
});
