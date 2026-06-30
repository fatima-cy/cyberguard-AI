import type { Request, Response, NextFunction } from 'express';
import { logger } from '../core/observability/logger';
import { ERROR_TYPES, ERROR_TITLES } from '@cyberguard/shared';

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const traceId = (req as any).traceId ?? 'not-available';
  const requestId = (req as any).requestId ?? 'not-available';

  res.status(404).json({
    type: ERROR_TYPES.NOT_FOUND,
    title: ERROR_TITLES[ERROR_TYPES.NOT_FOUND],
    status: 404,
    detail: `The requested path '${req.path}' was not found on this server.`,
    instance: req.path,
    requestId,
    traceId,
  });
}

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = (req as any).traceId ?? 'not-available';
  const requestId = (req as any).requestId ?? 'not-available';

  const status = err.status || err.statusCode || 500;
  const title = status === 429 ? ERROR_TITLES[ERROR_TYPES.RATE_LIMIT_EXCEEDED] : ERROR_TITLES[ERROR_TYPES.INTERNAL_ERROR];
  const type = status === 429 ? ERROR_TYPES.RATE_LIMIT_EXCEEDED : ERROR_TYPES.INTERNAL_ERROR;

  logger.error(err.message || 'Unhandled error occurred', {
    error: {
      message: err.message,
      stack: err.stack,
      status,
    },
    requestId,
    traceId,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({
    type,
    title,
    status,
    detail: err.message || 'An unexpected error occurred. Please try again later.',
    instance: req.path,
    requestId,
    traceId,
  });
}
