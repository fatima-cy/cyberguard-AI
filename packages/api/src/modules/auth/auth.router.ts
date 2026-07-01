/**
 * CyberGuard AI — Auth Router
 *
 * Mounted at /api/v1/auth
 *
 * Sprint 1.2: POST /register
 * Sprint 1.3: POST /login, POST /refresh, POST /logout, GET /me
 *
 * @see Blueprint §4.1 — Authentication Flow
 */

import { Router, type Request, type Response } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { registerSchema, loginSchema } from './auth.types';
import {
  registerUser,
  loginUser,
  refreshTokens,
} from './auth.service';
import { findUserById, toSafeUser } from '../../repositories/users.repository';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';
import { ERROR_TYPES } from '@cyberguard/shared';

export const authRouter = Router();

// ─── Helper: set refresh token cookie ────────────────────────────────────────

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(
    config.jwt.refreshCookieName,
    token,
    config.jwt.refreshCookieOptions,
  );
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(config.jwt.refreshCookieName, {
    path: config.jwt.refreshCookieOptions.path,
  });
}

// ─── POST /register ───────────────────────────────────────────────────────────

/**
 * Register a new user account.
 *
 * Body: { name, email, password }
 * Response 201: { user, accessToken }
 * Sets: HttpOnly refreshToken cookie
 */
authRouter.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { user, accessToken, refreshToken } = await registerUser(req.body);

    setRefreshCookie(res, refreshToken);

    res.status(201).json({ user, accessToken });
  } catch (err: any) {
    if (err.code === 'EMAIL_ALREADY_EXISTS') {
      res.status(409).json({
        type: ERROR_TYPES.BAD_REQUEST,
        title: 'Email Already Registered',
        status: 409,
        detail: 'An account with this email address already exists. Please sign in instead.',
        instance: req.path,
      });
      return;
    }
    throw err; // Passes to globalErrorHandler
  }
});

// ─── POST /login ──────────────────────────────────────────────────────────────

/**
 * Sign in with email and password.
 *
 * Body: { email, password }
 * Response 200: { user, accessToken }
 * Sets: HttpOnly refreshToken cookie
 */
authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { user, accessToken, refreshToken } = await loginUser(
      req.body.email,
      req.body.password,
    );

    setRefreshCookie(res, refreshToken);
    res.status(200).json({ user, accessToken });
  } catch (err: any) {
    if (err.code === 'INVALID_CREDENTIALS') {
      res.status(401).json({
        type: ERROR_TYPES.UNAUTHORIZED,
        title: 'Invalid Credentials',
        status: 401,
        detail: 'The email or password you entered is incorrect.',
        instance: req.path,
      });
      return;
    }
    throw err;
  }
});

// ─── POST /refresh ────────────────────────────────────────────────────────────

/**
 * Exchange a valid refresh token cookie for a new access token.
 *
 * Reads: HttpOnly refreshToken cookie
 * Response 200: { user, accessToken }
 * Sets: new HttpOnly refreshToken cookie (token rotation)
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.[config.jwt.refreshCookieName];

  if (!token) {
    res.status(401).json({
      type: ERROR_TYPES.UNAUTHORIZED,
      title: 'Unauthorized',
      status: 401,
      detail: 'No refresh token provided.',
      instance: req.path,
    });
    return;
  }

  try {
    const { user, accessToken, refreshToken } = await refreshTokens(token);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ user, accessToken });
  } catch {
    clearRefreshCookie(res);
    res.status(401).json({
      type: ERROR_TYPES.UNAUTHORIZED,
      title: 'Unauthorized',
      status: 401,
      detail: 'Refresh token is invalid or has expired. Please sign in again.',
      instance: req.path,
    });
  }
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

/**
 * Sign out the current user.
 * Clears the refresh token cookie.
 * Client is responsible for discarding the access token from memory.
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  clearRefreshCookie(res);
  logger.info('User logged out', { userId: req.user?.userId ?? 'unknown' });
  res.status(200).json({ message: 'Signed out successfully.' });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

/**
 * Return the currently authenticated user's profile.
 * Requires a valid access token.
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  

  
  const userDoc = await findUserById(req.user!.userId);

  if (!userDoc) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND,
      title: 'User Not Found',
      status: 404,
      detail: 'Your user account could not be found.',
      instance: req.path,
    });
    return;
  }

  res.status(200).json({ user: toSafeUser(userDoc) });
});
