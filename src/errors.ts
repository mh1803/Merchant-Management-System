export class AppError extends Error {
  statusCode: number;
  code: string | undefined;
  details: unknown;

  constructor(statusCode: number, message: string, code?: string, options?: { details?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
  }
}
