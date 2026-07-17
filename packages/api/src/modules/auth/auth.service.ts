/**
 * CyberGuard AI — Auth Service
 * Sprint 2.5: Email verification and password reset added
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';
import {
  findUserByEmail,
  findUserById,
  findUserByToken,
  createUser,
  toSafeUser,
  updateUser,
} from '../../repositories/users.repository';
import { sendEmailVerification, sendPasswordReset } from '../../services/email.service';
import type { RegisterRequest } from './auth.types';
import type { User, JwtPayload } from '@cyberguard/shared';

const BCRYPT_ROUNDS = 12;

// ─── Token generation ─────────────────────────────────────────────────────────

export function generateAccessToken(user: User): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpiry as any });
}

export function generateRefreshToken(userId: string, version: number): string {
  return jwt.sign(
    { sub: userId, version, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiry as any },
  );
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Register ─────────────────────────────────────────────────────────────────

export interface RegisterResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Sprint 4.2.1 — invitation-aware registration. Kept as imports at the top
// of this modified block rather than a separate file, since these are only
// used here.
import { validateAndConsumeInvitation } from '../invitations/invitations.service';
import { incrementMemberCount } from '../../repositories/organizations.repository';

export async function registerUser(data: RegisterRequest): Promise<RegisterResult> {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    const err = new Error('Email already registered') as any;
    err.statusCode = 409;
    err.code = 'EMAIL_ALREADY_EXISTS';
    throw err;
  }

  // Sprint 4.2.1: if an invite token is present, this registration joins an
  // EXISTING org with a pre-assigned role instead of starting with
  // organizationId: null. Validated/consumed BEFORE creating the user so a
  // bad token fails the whole registration cleanly rather than leaving an
  // orphaned user record with no org.
  let inviteResult: { organizationId: string; organizationName: string; role: 'org_admin' | 'standard' } | null = null;
  if (data.inviteToken) {
    inviteResult = await validateAndConsumeInvitation(data.inviteToken, data.email);
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const userId = uuidv4();
  const verificationToken = generateSecureToken();

  const userDoc = await createUser({
    id: userId,
    email: data.email,
    name: data.name,
    role: inviteResult ? inviteResult.role : 'standard',
    organizationId: inviteResult ? inviteResult.organizationId : null,
    passwordHash,
    refreshTokenVersion: 0,
    // Invited users' email is implicitly verified — the invitation itself
    // was sent to this exact address, which is proof of ownership.
    emailVerified: inviteResult ? true : false,
    emailVerificationToken: inviteResult ? undefined : verificationToken,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const user = toSafeUser(userDoc);

  if (inviteResult) {
    await incrementMemberCount(inviteResult.organizationId).catch(err => {
      // Don't fail registration over this — the user record and org
      // assignment are already correct; memberCount is a display counter,
      // not the source of truth for membership itself.
      logger.error('Failed to increment memberCount after invited registration', { userId, organizationId: inviteResult!.organizationId, error: err.message });
    });
  } else {
    // Send verification email — non-blocking, don't fail registration if email fails
    sendEmailVerification(data.email, data.name, verificationToken).catch(err => {
      logger.warn('Failed to send verification email', { userId, error: err.message });
    });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(userId, 0);

  logger.info('User registered', { userId, email: data.email, viaInvite: !!inviteResult });
  return { user, accessToken, refreshToken };
}

// ─── Email verification ───────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<void> {
  const userDoc = await findUserByToken('emailVerificationToken', token);

  if (!userDoc) {
    const err = new Error('Invalid or expired verification token') as any;
    err.statusCode = 400;
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  if (userDoc.emailVerified) return; // Already verified — idempotent

  const partitionKey = userDoc.organizationId ?? userDoc.id;
  await updateUser(userDoc.id, partitionKey, {
    emailVerified: true,
    emailVerificationToken: undefined as any, // Remove token after use
  });

  logger.info('Email verified', { userId: userDoc.id });
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const userDoc = await findUserById(userId);
  if (!userDoc || userDoc.emailVerified) return;

  const token = generateSecureToken();
  const partitionKey = userDoc.organizationId ?? userDoc.id;

  await updateUser(userDoc.id, partitionKey, { emailVerificationToken: token });
  await sendEmailVerification(userDoc.email, userDoc.name, token);

  logger.info('Verification email resent', { userId });
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const userDoc = await findUserByEmail(email);

  // Always return success — don't reveal whether email exists
  if (!userDoc) return;

  const token = generateSecureToken();
  const expiry = new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(); // 1 hour
  const partitionKey = userDoc.organizationId ?? userDoc.id;

  await updateUser(userDoc.id, partitionKey, {
    passwordResetToken: token,
    passwordResetExpiry: expiry,
  });

  await sendPasswordReset(userDoc.email, userDoc.name, token).catch(err => {
    logger.warn('Failed to send password reset email', { userId: userDoc.id, error: err.message });
  });

  logger.info('Password reset requested', { userId: userDoc.id });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userDoc = await findUserByToken('passwordResetToken', token);

  if (!userDoc) {
    const err = new Error('Invalid or expired reset token') as any;
    err.statusCode = 400;
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  console.log('RESET: userDoc found, expiry:', userDoc.passwordResetExpiry, 'now:', new Date().toISOString());
  // Check expiry
  if (userDoc.passwordResetExpiry && new Date(userDoc.passwordResetExpiry) < new Date()) {
    const err = new Error('Reset token has expired') as any;
    err.statusCode = 400;
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const partitionKey = userDoc.organizationId ?? userDoc.id;
  console.log('RESET: partitionKey:', partitionKey);
  await updateUser(userDoc.id, partitionKey, {
    passwordHash,
    passwordResetToken: null as any,
    passwordResetExpiry: null as any,
    refreshTokenVersion: (userDoc.refreshTokenVersion ?? 0) + 1, // Invalidate all sessions
  });

  logger.info('Password reset completed', { userId: userDoc.id });
}

// ─── Login ────────────────────────────────────────────────────────────────────

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const authError = new Error('Invalid email or password') as any;
  authError.statusCode = 401;
  authError.code = 'INVALID_CREDENTIALS';

  const userDoc = await findUserByEmail(email);
  if (!userDoc) throw authError;

  const valid = await bcrypt.compare(password, userDoc.passwordHash);
  if (!valid) throw authError;

  const user = toSafeUser(userDoc);
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(userDoc.id, userDoc.refreshTokenVersion);

  logger.info('User logged in', { userId: userDoc.id });
  return { user, accessToken, refreshToken };
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export interface RefreshResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  const invalidErr = new Error('Invalid or expired refresh token') as any;
  invalidErr.statusCode = 401;

  let payload: any;
  try {
    payload = jwt.verify(refreshToken, config.jwt.secret);
  } catch { throw invalidErr; }

  if (payload.type !== 'refresh') throw invalidErr;

  const userDoc = await findUserById(payload.sub);
  if (!userDoc) throw invalidErr;
  if (userDoc.refreshTokenVersion !== payload.version) throw invalidErr;

  const user = toSafeUser(userDoc);
  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(userDoc.id, userDoc.refreshTokenVersion);

  return { user, accessToken, refreshToken: newRefreshToken };
}
