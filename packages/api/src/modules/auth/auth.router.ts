/**
 * CyberGuard AI — Auth Router
 * Sprint 2.5: Email verification + Password reset endpoints added
 *
 * New endpoints:
 *   POST /auth/verify-email       — verify email with token from link
 *   POST /auth/resend-verification — resend verification email
 *   POST /auth/forgot-password    — request password reset email
 *   POST /auth/reset-password     — set new password with token
 */

import { Router, type Request, type Response } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { registerSchema, loginSchema } from './auth.types';
import {
  registerUser,
  loginUser,
  refreshTokens,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
} from './auth.service';
import { findUserById, toSafeUser } from '../../repositories/users.repository';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';
import { ERROR_TYPES } from '@cyberguard/shared';
import { z } from 'zod';

export const authRouter = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(config.jwt.refreshCookieName, token, config.jwt.refreshCookieOptions);
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(config.jwt.refreshCookieName, { path: config.jwt.refreshCookieOptions.path });
}

// ─── POST /register ───────────────────────────────────────────────────────────

authRouter.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { user, accessToken, refreshToken } = await registerUser(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user, accessToken, emailVerificationSent: true });
  } catch (err: any) {
    if (err.code === 'EMAIL_ALREADY_EXISTS') {
      res.status(409).json({ type: ERROR_TYPES.BAD_REQUEST, title: 'Email Already Registered', status: 409, detail: 'An account with this email address already exists.', instance: req.path });
      return;
    }
    throw err;
  }
});

// ─── POST /login ──────────────────────────────────────────────────────────────

authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { user, accessToken, refreshToken } = await loginUser(req.body.email, req.body.password);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ user, accessToken });
  } catch (err: any) {
    if (err.code === 'INVALID_CREDENTIALS') {
      res.status(401).json({ type: ERROR_TYPES.UNAUTHORIZED, title: 'Invalid Credentials', status: 401, detail: 'The email or password you entered is incorrect.', instance: req.path });
      return;
    }
    throw err;
  }
});

// ─── POST /refresh ────────────────────────────────────────────────────────────

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.[config.jwt.refreshCookieName];
  if (!token) {
    res.status(401).json({ type: ERROR_TYPES.UNAUTHORIZED, title: 'Unauthorized', status: 401, detail: 'No refresh token provided.', instance: req.path });
    return;
  }
  try {
    const { user, accessToken, refreshToken } = await refreshTokens(token);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ user, accessToken });
  } catch {
    clearRefreshCookie(res);
    res.status(401).json({ type: ERROR_TYPES.UNAUTHORIZED, title: 'Unauthorized', status: 401, detail: 'Refresh token is invalid or has expired.', instance: req.path });
  }
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

authRouter.post('/logout', (req: Request, res: Response) => {
  clearRefreshCookie(res);
  logger.info('User logged out', { userId: req.user?.userId ?? 'unknown' });
  res.status(200).json({ message: 'Signed out successfully.' });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const userDoc = await findUserById(req.user!.userId);
  if (!userDoc) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'User Not Found', status: 404, detail: 'Your user account could not be found.', instance: req.path });
    return;
  }
  res.status(200).json({ user: toSafeUser(userDoc) });
});

// ─── POST /verify-email ───────────────────────────────────────────────────────

authRouter.post(
  '/verify-email',
  validate(z.object({ token: z.string().min(1) })),
  async (req: Request, res: Response) => {
    try {
      await verifyEmail(req.body.token);
      res.status(200).json({ message: 'Email verified successfully.' });
    } catch (err: any) {
      res.status(400).json({ type: ERROR_TYPES.BAD_REQUEST, title: 'Verification Failed', status: 400, detail: 'The verification link is invalid or has expired.', instance: req.path });
    }
  },
);

// ─── POST /resend-verification ────────────────────────────────────────────────

authRouter.post('/resend-verification', requireAuth, async (req: Request, res: Response) => {
  await resendVerificationEmail(req.user!.userId).catch(() => {});
  // Always return 200 — don't reveal if user exists or is already verified
  res.status(200).json({ message: 'If your email is unverified, a new link has been sent.' });
});

// ─── POST /forgot-password ────────────────────────────────────────────────────

authRouter.post(
  '/forgot-password',
  validate(z.object({ email: z.string().email().toLowerCase().trim() })),
  async (req: Request, res: Response) => {
    await requestPasswordReset(req.body.email).catch(() => {});
    // Always return 200 — don't reveal whether email exists
    res.status(200).json({ message: 'If an account exists with that email, a reset link has been sent.' });
  },
);

// ─── POST /reset-password ─────────────────────────────────────────────────────

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

authRouter.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    await resetPassword(req.body.token, req.body.password);
    res.status(200).json({ message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (err: any) {
    res.status(400).json({ type: ERROR_TYPES.BAD_REQUEST, title: 'Reset Failed', status: 400, detail: err.code === 'TOKEN_EXPIRED' ? 'The reset link has expired. Please request a new one.' : 'The reset link is invalid or has already been used.', instance: req.path });
  }
});
