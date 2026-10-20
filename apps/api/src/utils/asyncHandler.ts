import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Higher-order function that wraps async route handlers to catch errors.
 * Ensures rejected promises are forwarded to Express error middleware.
 */
const asyncHandler =
  <T = unknown>(
    requestHandler: (req: Request, res: Response, next: NextFunction) => Promise<T>
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch(next);
  };

export { asyncHandler };
export default asyncHandler;
