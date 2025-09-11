import { authService } from '../../../src/services/authService';
import { db } from '../../../src/db/knex';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

jest.mock('../../../src/db/knex', () => {
  const tables: any = {
    users: {
      select: jest.fn(),
      where: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      first: jest.fn(),
      returning: jest.fn(),
    },
  };
  const db: any = (table: string) => tables[table];
  return { db };
});

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('authService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('register creates user and returns token', async () => {
    const insertReturning = jest.fn().mockResolvedValue([
      {
        id: 'u1',
        email: 'jane@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
        password_hash: 'hash',
      },
    ]);
    (db as any)('users').where = jest
      .fn()
      .mockReturnValue({ first: jest.fn().mockResolvedValue(undefined) });
    (db as any)('users').insert = jest.fn().mockReturnThis();
    (db as any)('users').returning = insertReturning;

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
    (jwt.sign as jest.Mock).mockReturnValue('jwt');

    const res = await authService.register('jane@example.com', 'pw', 'Jane', 'Doe');
    expect(res.token).toBe('jwt');
    expect(res.user).toEqual(expect.objectContaining({ email: 'jane@example.com' }));
  });

  it('login throws on invalid email', async () => {
    (db as any).where = jest
      .fn()
      .mockReturnValue({ first: jest.fn().mockResolvedValue(undefined) });
    await expect(authService.login('none@example.com', 'pw')).rejects.toThrow(
      'Invalid credentials'
    );
  });

  it('login returns token on valid credentials', async () => {
    (db as any)('users').where = jest.fn().mockReturnValue({
      first: jest
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'jane@example.com', password_hash: 'hash' }),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('jwt');

    const res = await authService.login('jane@example.com', 'pw');
    expect(res.token).toBe('jwt');
    expect(res.user.email).toBe('jane@example.com');
  });
});
