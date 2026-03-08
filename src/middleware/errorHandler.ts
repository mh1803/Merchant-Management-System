import Joi from 'joi';
import { ErrorRequestHandler } from 'express';
import { AppError } from '../errors';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof Joi.ValidationError) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.details.map((item) => item.message)
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      code: error.code || 'APP_ERROR',
      message: error.message
    });
  }

  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected server error'
  });
};
