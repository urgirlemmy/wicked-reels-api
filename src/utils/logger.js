import winston from 'winston';

const { combine, timestamp, colorize, printf, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),   // captures stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize(),
    logFormat,
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

export default logger;