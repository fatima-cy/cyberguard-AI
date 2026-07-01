/**
 * CyberGuard AI — Auth Middleware
 *
 * Verifies JWT access tokens on every protected route.
 * Attaches the decoded payload to `req.user` for downstream handlers.
 *
 * Usage:
 *   import { requireAuth } from '../middleware/auth.middleware';
 *   router.get('/protected', requireAuth, handler);
 *
 *   // Require a specific role:
 *   router.post('/admin', requireAuth, requireRole('super_admin'), handler);
 *
 * @see Blueprint §4.1 — JWT Strategy (15-min access tokens, 7-day refresh)
 * @see Sprint 1.1
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from '../core/observability/logger';
import type { JwtPayload, AuthenticatedUser, UserRole } from '@cyberguard/shared';
import { ERROR_TYPES } from '@cyberguard/shared';

// ─── Extend Express Request ───────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

/**
 * Middleware that validates a Bearer JWT access token.
 * On success, sets `req.user` and calls `next()`.
 * On failure, returns 401 with a Problem Detail body.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      type: ERROR_TYPES.UNAUTHORIZED,
      title: 'Unauthorized',
      status: 401,
      detail: 'Authorization header missing or malformed. Expected: Bearer <token>',
      instance: req.path,
    });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    req.user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    const isInvalid = err instanceof jwt.JsonWebTokenError;

    if (!config.app.isProduction) {
      logger.debug('JWT verification failed', {
        error: (err as Error).message,
        path: req.path,
      });
    }

    res.status(401).json({
      type: ERROR_TYPES.UNAUTHORIZED,
      title: 'Unauthorized',
      status: 401,
      detail: isExpired
        ? 'Access token has expired. Request a new token using your refresh token.'
        : isInvalid
        ? 'Access token is invalid or has been tampered with.'
        : 'Authentication failed.',
      instance: req.path,
    });
  }
}

// ─── requireRole ─────────────────────────────────────────────────────────────

/**
 * Role-based access control middleware factory.
 * Must be used AFTER requireAuth (depends on req.user being set).
 *
 * @example
 *   router.delete('/users/:id', requireAuth, requireRole('super_admin'), handler);
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Should not happen if requireAuth is used first — defensive check
      res.status(401).json({
        type: ERROR_TYPES.UNAUTHORIZED,
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required.',
        instance: req.path,
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Role check failed', {
        userId: req.user.userId,
        requiredRoles: roles,
        actualRole: req.user.role,
        path: req.path,
      });

      res.status(403).json({
        type: ERROR_TYPES.FORBIDDEN,
        title: 'Forbidden',
        status: 403,
        detail: `This action requires one of the following roles: ${roles.join(', ')}.`,
        instance: req.path,
      });
      return;
    }

    next();
  };
}

// ─── requireOrganisation ─────────────────────────────────────────────────────

/**
 * Ensures the authenticated user belongs to an organisation.
 * Rejects requests from users who registered but haven't created/joined an org.
 * Must be used AFTER requireAuth.
 */
export function requireOrganisation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.organizationId) {
    res.status(403).json({
      type: ERROR_TYPES.FORBIDDEN,
      title: 'Organisation Required',
      status: 403,
      detail: 'You must create or join an organisation before accessing this resource.',
      instance: req.path,
    });
    return;
  }
  next();
}
