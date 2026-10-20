export class ApiResponse<T = unknown> {
  readonly statusCode: number;
  readonly data: T;
  readonly message: string;
  readonly success: boolean;

  constructor(statusCode: number, data: T, message: string = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}
