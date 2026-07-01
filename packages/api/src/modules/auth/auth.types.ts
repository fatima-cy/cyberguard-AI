/**
 * CyberGuard AI — Auth Module Types
 *
 * Zod schemas for request validation and TypeScript types for responses.
 * Schemas are the source of truth — types are inferred from them.
 *
 * @see Sprint 1.2 (register), Sprint 1.3 (login, refresh, logout)
 */

import { z } from 'zod';
import type { User } from '@cyberguard/shared';

// ─── Password rules ───────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(254, 'Email must not exceed 254 characters')
    .toLowerCase()
    .trim(),
  password: passwordSchema,
});

export type RegisterRequest = z.infer<typeof registerSchema>;

export interface RegisterResponse {
  user: User;
  accessToken: string;
}

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export interface LoginResponse {
  user: User;
  accessToken: string;
}

// ─── Me ───────────────────────────────────────────────────────────────────────

export interface MeResponse {
  user: User;
}
