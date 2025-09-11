import { Router } from 'express';
import { healthCheck } from '../controllers/health';

export const healthCheckRouter = Router();

healthCheckRouter.get('/', healthCheck);
