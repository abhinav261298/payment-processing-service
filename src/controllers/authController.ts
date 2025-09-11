import { Request, Response } from 'express';
import { authService } from '../services/authService';
// Use require to avoid TypeScript module issues with express-validator
const { validationResult } = require('express-validator');

export const authController = {
  async register(req: Request, res: Response) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name } = req.body;
      const [firstName, ...rest] = (name || '').trim().split(' ');
      const lastName = rest.join(' ').trim() || '';
      const { user, token } = await authService.register(email, password, firstName, lastName);

      res.status(201).json({
        success: true,
        data: {
          user: {
            ...user,
            name: `${(user as any).first_name ?? ''} ${(user as any).last_name ?? ''}`.trim(),
          },
          token,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async login(req: Request, res: Response) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const { user, token } = await authService.login(email, password);

      res.json({
        success: true,
        data: {
          user: {
            ...user,
            name: `${(user as any).first_name ?? ''} ${(user as any).last_name ?? ''}`.trim(),
          },
          token,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }
  },

  async getCurrentUser(req: Request, res: Response) {
    try {
      // The user should be attached to the request by the auth middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const user = await req.app.locals
        .db('users')
        .where({ id: req.user.id })
        .select('id', 'first_name', 'last_name', 'email', 'created_at', 'updated_at')
        .first();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        data: {
          ...user,
          name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Server error',
      });
    }
  },
};
