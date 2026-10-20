import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { NODE_ENV } from '../config/env';

// Define custom severity levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

type LogLevel = keyof typeof levels;

// Select log level based on environment
const level = (): LogLevel => {
  const env = NODE_ENV ?? 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define colors for each log level
const colors: Record<LogLevel, string> = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  http: 'magenta',
  debug: 'white',
};

// Link colors to Winston levels
winston.addColors(colors);

// Customize log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'DD MMM, YYYY - HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
    const { timestamp, level, message } = info;
    return `[${timestamp}] ${level}: ${String(message)}`;
  })
);

// Configure transports
const transports: winston.transport[] = [new winston.transports.Console()];

// In serverless environments like Vercel or AWS Lambda, the filesystem is read-only.
// We only enable local file transports when running in local development outside Vercel.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const isDevelopment = (NODE_ENV ?? 'development') === 'development';

if (!isServerless && isDevelopment) {
  try {
    const logsDir = path.resolve(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'info.log'),
        level: 'info',
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'http.log'),
        level: 'http',
      })
    );
  } catch (err) {
    console.warn('Could not initialize local file loggers, falling back to console:', err);
  }
}

// Create and export the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;
export { logger };
