import { authController } from '../../../src/controllers/authController';
import { authService } from '../../../src/services/authService';

// Mock express-validator validationResult
jest.mock('express-validator', () => ({
  validationResult: () => ({ isEmpty: () => true, array: () => [] }),
}));

jest.mock('../../../src/services/authService');

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.app = { locals: { db: {} } };
  return res;
}

describe('authController', () => {
  beforeEach(() => jest.clearAllMocks());

  it('register should return 201 with user and token', async () => {
    (authService.register as jest.Mock).mockResolvedValueOnce({
      user: { id: 'u1', email: 'test@example.com', first_name: 'Test', last_name: 'User' },
      token: 'jwt',
    });

    const req: any = { body: { name: 'Test User', email: 'test@example.com', password: 'pass' } };
    const res = createRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ token: 'jwt' }) })
    );
  });

  it('login should return 200 with user and token', async () => {
    (authService.login as jest.Mock).mockResolvedValueOnce({
      user: { id: 'u1', email: 'test@example.com', first_name: 'Test', last_name: 'User' },
      token: 'jwt',
    });

    const req: any = { body: { email: 'test@example.com', password: 'pass' } };
    const res = createRes();

    await authController.login(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ token: 'jwt' }) })
    );
  });

  it('getCurrentUser should return 401 when no user in request', async () => {
    const req: any = { user: null, app: { locals: { db: jest.fn() } } };
    const res = createRes();

    await authController.getCurrentUser(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
