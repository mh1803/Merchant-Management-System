import { ErrorRequestHandler } from 'express';
import { AppError } from '../errors';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    const response: Record<string, unknown> = {
      code: error.code || 'APP_ERROR',
      message: error.message
    };

    if (typeof error.details !== 'undefined') {
      response.details = error.details;
    }

    return res.status(error.statusCode).json(response);
  }

  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected server error'
  });
};
