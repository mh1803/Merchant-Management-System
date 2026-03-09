import { RequestHandler } from 'express';

// The 404 handler runs after all routers so unmatched paths return a consistent API error shape.
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'Route not found'
  });
};
