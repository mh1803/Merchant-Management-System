const Joi = require('joi');
const { AppError } = require('../errors');

function errorHandler(error, req, res, next) {
  if (error instanceof Joi.ValidationError) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.details.map((item) => item.message)
    });
  }

  if (error instanceof AppError) {
    const payload = {
      code: error.code || 'APP_ERROR',
      message: error.message
    };

    return res.status(error.statusCode).json(payload);
  }

  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected server error'
  });
}

module.exports = { errorHandler };
