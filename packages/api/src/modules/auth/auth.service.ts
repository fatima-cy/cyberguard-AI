/**
 * CyberGuard AI — Auth Service
 *
 * Business logic for authentication operations.
 * Keeps routers thin — all decisions happen here.
 *
 * JWT strategy:
 *   - Access token:  15 minutes, signed with JWT_SECRET, returned in response body
 *   - Refresh token: 7 days, signed with JWT_SECRET, sent as HttpOnly cookie
 *
 * @see Blueprint §4.1 — JWT Strategy
 * @see Sprint 1.2 (register), Sprint 1.3 (login, refresh, logout)
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';
import {
  findUserByEmail,
  findUserById,
  createUser,
  toSafeUser,
} from '../../repositories/users.repository';
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

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry as any,
  });
}

export function generateRefreshToken(userId: string, version: number): string {
  return jwt.sign(
    { sub: userId, version, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiry as any },
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────

export interface RegisterResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(data: RegisterRequest): Promise<RegisterResult> {
  // 1. Check for duplicate email
  const existing = await findUserByEmail(data.email);
  if (existing) {
    const err = new Error('Email already registered') as any;
    err.statusCode = 409;
    err.code = 'EMAIL_ALREADY_EXISTS';
    throw err;
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  // 3. Create user document
  const userId = uuidv4();
  const userDoc = await createUser({
    id: userId,
    email: data.email,
    name: data.name,
    role: 'standard',
    organizationId: null,
    passwordHash,
    refreshTokenVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const user = toSafeUser(userDoc);

  // 4. Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(userId, 0);

  logger.info('User registered', {
    userId,
    email: data.email, // email is not PII-sensitive in logs for this platform
  });

  return { user, accessToken, refreshToken };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  // 1. Find user — use same error for wrong email AND wrong password (no enumeration)
  const authError = new Error('Invalid email or password') as any;
  authError.statusCode = 401;
  authError.code = 'INVALID_CREDENTIALS';

  const userDoc = await findUserByEmail(email);
  if (!userDoc) throw authError;

  // 2. Verify password
  const valid = await bcrypt.compare(password, userDoc.passwordHash);
  if (!valid) throw authError;

  const user = toSafeUser(userDoc);

  // 3. Generate tokens
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
  } catch {
    throw invalidErr;
  }

  if (payload.type !== 'refresh') throw invalidErr;

  // Fetch user to validate token version (invalidates tokens after logout)
  
  const userDoc = await findUserById(payload.sub);
  if (!userDoc) throw invalidErr;
  if (userDoc.refreshTokenVersion !== payload.version) throw invalidErr;

  const user = toSafeUser(userDoc);
  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(userDoc.id, userDoc.refreshTokenVersion);

  return { user, accessToken, refreshToken: newRefreshToken };
}
