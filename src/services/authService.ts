import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/knex';
import { User } from '../types/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export interface AuthResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const authService = {
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role = 'user'
  ): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [user] = await db('users')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        password_hash: hashedPassword,
        role,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Generate JWT token
    const token = this.generateToken({ id: user.id, email: user.email });

    // Remove password hash from user object
    const { password_hash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    // Find user by email
    const user = await db('users').where({ email }).first();
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    // Remove password hash from user object
    const { password_hash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  },

  generateToken(user: Pick<User, 'id' | 'email'>): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
        algorithm: 'HS256',
      } as jwt.SignOptions
    );
  },

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  },

  /**
   * Get user by ID without password hash
   */
  async getUserById(userId: string): Promise<Omit<User, 'password_hash'> | null> {
    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'created_at', 'updated_at')
      .where('id', userId)
      .first();

    return user || null;
  },
};
