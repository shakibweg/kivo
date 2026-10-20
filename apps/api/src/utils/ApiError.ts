/**
 * @description Common Error class to throw an error from anywhere.
 * The errorHandler middleware will catch this error at a central place
 * and return an appropriate response to the client.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly data: null;
  readonly success: false;
  readonly errors: unknown[];

  constructor(
    statusCode: number,
    message: string = 'Something went wrong',
    errors: unknown[] = [],
    stack: string = ''
  ) {
    super(message);

    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      // Maintain proper stack trace (V8 environments)
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
