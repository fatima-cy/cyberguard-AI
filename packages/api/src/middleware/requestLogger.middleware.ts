import type { Request, Response, NextFunction } from 'express';
import { logger } from '../core/observability/logger';
import type { AuthenticatedUser } from '@cyberguard/shared';

type AuthedRequest = Request & { user?: AuthenticatedUser; requestId?: string; traceId?: string };

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const authReq = req as AuthedRequest;

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    const logData = {
      requestId: authReq.requestId ?? 'unknown',
      correlationId: authReq.traceId ?? 'unknown',
      tenantId: authReq.user?.organizationId ?? 'unauthenticated',
      userId: authReq.user?.userId ?? 'unauthenticated',
      method: req.method,
      path: req.path,
      statusCode,
      durationMs,
      userAgent: req.get('user-agent') ?? 'unknown',
      contentLength: res.get('content-length') ?? 0,
    };

    if (statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}
