import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Create a basic logger without the problematic serializers
const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

export { logger };
