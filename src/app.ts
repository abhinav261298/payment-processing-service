import express, {
  Application,
  Request,
  Response,
  NextFunction,
  RequestHandler,
  RequestHandler as ExpressRequestHandler,
} from 'express';
import { createServer, Server as HttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import bodyParser from 'body-parser';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { healthCheckRouter } from './routes/health';
import { webhookRouter } from './routes/webhooks';

export class App {
  private app: Application;
  private server: HttpServer | null = null;
  private port: number | string;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Request logging
    this.app.use(
      pinoHttp({
        logger: logger as any, // Type assertion to fix type issues
        autoLogging: {
          ignore: (req: Request) =>
            req.url?.startsWith('/health') || req.url?.startsWith('/webhooks') || false,
        },
      })
    );

    // Security headers - exclude webhooks from some security middlewares
    this.app.use((req, res, next) => {
      if (req.path.startsWith('/webhooks')) {
        // Skip some security middlewares for webhooks to allow Authorize.net requests
        helmet({
          contentSecurityPolicy: false,
          dnsPrefetchControl: false,
          frameguard: false,
          hsts: false,
          ieNoOpen: false,
          noSniff: false,
          xssFilter: false,
        })(req, res, next);
      } else {
        helmet()(req, res, next);
      }
    });

    // Enable CORS
    this.app.use(cors());

    // Body parsing configuration
    this.initializeBodyParsers();

    // Response compression (exclude webhooks)
    this.app.use((req, res, next) => {
      if (!req.path.startsWith('/webhooks')) {
        compression()(req, res, next);
      } else {
        next();
      }
    });
  }

  private initializeBodyParsers(): void {
    // Raw body parser for webhooks (before json/urlencoded)
    this.app.use(
      '/webhooks',
      bodyParser.raw({
        type: '*/*',
        verify: (req: any, res, buf) => {
          if (req.originalUrl.startsWith('/webhooks/authorizenet')) {
            req.rawBody = buf.toString();
          }
        },
      })
    );

    // Standard JSON and URL-encoded parsers
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.use('/health', healthCheckRouter);

    // Webhook routes (no JSON parsing, handled by raw body parser)
    this.app.use('/webhooks', webhookRouter);

    // API routes will be added here
    this.app.get('/', (req: Request, res: Response) => {
      res.json({ message: 'Payment Processing Service API' });
    });
    this.app.use('/api/v1', (req: Request, res: Response) => {
      res.json({ message: 'API is working' });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public start(): void {
    this.server = createServer(this.app);
    this.server.listen(this.port, () => {
      logger.info(`Server is running on port ${this.port}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
      logger.error(`Unhandled Rejection at: ${reason.stack || reason}`);
      // Consider restarting the server or doing some cleanup
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error(`Uncaught Exception: ${error.stack || error}`);
      // Consider restarting the server or doing some cleanup
      process.exit(1);
    });
  }

  public getServer(): Application {
    return this.app;
  }

  public close(): void {
    if (this.server) {
      this.server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    }
  }
}

// For running the server directly with ts-node
export const app = new App();

if (require.main === module) {
  app.start();
}
