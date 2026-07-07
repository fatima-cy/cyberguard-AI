/**
 * CyberGuard AI — User Domain Types
 * Sprint 2.5: emailVerified, emailVerificationToken, passwordResetToken, passwordResetExpiry added
 */

export type UserRole = 'super_admin' | 'org_admin' | 'standard';
export type SubscriptionTier = 'free' | 'professional' | 'enterprise';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDocument extends User {
  passwordHash: string;
  refreshTokenVersion: number;
  emailVerified?: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpiry?: string;
  _partitionKey: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
}
