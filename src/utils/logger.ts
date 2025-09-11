import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Avoid using pino-pretty transport (which uses worker threads) in test environment
const baseOptions: pino.LoggerOptions = {
  level: isProduction ? 'info' : 'debug',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

const logger = pino(
  isTest
    ? baseOptions // no transport in tests to avoid open handles
    : {
        ...baseOptions,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
);

export { logger };
