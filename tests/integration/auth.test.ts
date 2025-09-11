import request from 'supertest';
import express from 'express';
import { testDb } from '../test-setup';
import { authRouter } from '../../src/routes/auth';
import { errorHandler } from '../../src/middleware/error.middleware';
import { authService } from '../../src/services/authService';

// Create a test Express app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Set up the database connection
  app.locals.db = testDb;

  // Setup routes
  app.use('/api/auth', authRouter);

  // Setup error handling
  app.use(errorHandler);

  return app;
};

// Create test API
const app = createTestApp();
const api = request(app);

// Helper function to create a test user
const createTestUser = async (userData: { email: string; password: string; name: string }) => {
  const hashedPassword = await require('bcryptjs').hash(userData.password, 10);
  const [firstName, ...rest] = userData.name.trim().split(' ');
  const lastName = rest.join(' ').trim() || '';
  const [user] = await testDb('users')
    .insert({
      email: userData.email,
      first_name: firstName,
      last_name: lastName,
      password_hash: hashedPassword,
      role: 'user',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'first_name', 'last_name', 'email', 'created_at', 'updated_at']);
  return user;
};

describe('Auth API', () => {
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  };

  beforeAll(async () => {
    // Clean up test data
    await testDb.raw('TRUNCATE TABLE users CASCADE');
  });

  afterEach(async () => {
    // Clean up test data after each test
    await testDb.raw('TRUNCATE TABLE users CASCADE');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await api
        .post('/api/auth/register')
        .send(testUser)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
      expect(response.body.data.user).toHaveProperty('name', testUser.name);
      expect(response.body.data).toHaveProperty('token');
    });

    it('should not register a user with an existing email', async () => {
      // First, create a user with the test email
      await createTestUser(testUser);

      // Try to register the same user again
      const response = await api
        .post('/api/auth/register')
        .send(testUser)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'User already exists with this email');
    });

    it('should validate input data', async () => {
      const response = await api
        .post('/api/auth/register')
        .send({
          name: '',
          email: 'invalid-email',
          password: '123',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user before login tests
      await createTestUser(testUser);
    });

    it('should login with valid credentials', async () => {
      const response = await api
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
      expect(response.body.data).toHaveProperty('token');
    });

    it('should not login with invalid credentials', async () => {
      const response = await api
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;
    let testUserId: string;

    beforeEach(async () => {
      // Create a test user and get a valid token
      const user = await createTestUser(testUser);
      testUserId = user.id;

      // Manually generate a token for the test user
      authToken = authService.generateToken({ id: testUserId, email: testUser.email });
    });

    it('should get current user with valid token', async () => {
      const response = await api
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('email', testUser.email);
      expect(response.body.data).toHaveProperty('name', testUser.name);
    });

    it('should not get current user without token', async () => {
      const response = await api.get('/api/auth/me').expect('Content-Type', /json/).expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'No token, authorization denied');
    });

    it('should not get current user with invalid token', async () => {
      const response = await api
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Token is not valid');
    });
  });
});
