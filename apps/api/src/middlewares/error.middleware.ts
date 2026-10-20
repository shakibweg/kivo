import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import logger from '../logger/winston.logger';
import { ApiError } from '../utils/ApiError';
import { NODE_ENV } from '../config/env';

/**
 * This middleware is responsible for catching errors from any request handler
 * wrapped inside asyncHandler or forwarded via next(err).
 */
const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error: ApiError;

  // Normalize any thrown value into an ApiError instance
  if (err instanceof ApiError) {
    error = err;
  } else {
    // Best-effort extraction from unknown error shapes
    const maybeErr = err as Partial<{
      statusCode: number;
      message: string;
      errors: unknown[];
      stack: string;
    }>;

    const statusCode = maybeErr?.statusCode ? maybeErr.statusCode : 500;
    const message = maybeErr?.message ?? 'Something went wrong';

    error = new ApiError(statusCode, message, maybeErr?.errors ?? [], maybeErr?.stack);
  }

  // Shape the response; include stack only in development
  const response: Record<string, unknown> = {
    ...error,
    message: error.message,
    ...(NODE_ENV === 'development' ? { stack: error.stack } : {}),
  };

  logger.error(`${error.message}`);

  return res.status(error.statusCode).json(response);
};

export { errorHandler };
export default errorHandler;
