/**
 * CyberGuard AI — User Domain Types
 *
 * Shared between API and frontend. These are the canonical type definitions
 * for user documents as stored in Cosmos DB and as returned by the API.
 *
 * IMPORTANT: The `passwordHash` field exists only in the Cosmos document type
 * (`UserDocument`). It is NEVER present in `User` (the API response type).
 * The API layer is responsible for omitting it before returning responses.
 *
 * @see Blueprint §4.1 — Identity & Access Management
 * @see Cosmos container: users (partition key: /organizationId)
 */

export type UserRole = 'super_admin' | 'org_admin' | 'standard';

export type SubscriptionTier = 'free' | 'professional' | 'enterprise';

/** Safe user object — never contains passwordHash. Used in API responses. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string | null;  // null until org is created/joined
  createdAt: string;              // ISO 8601
  updatedAt: string;
}

/** Full Cosmos document — includes passwordHash. NEVER returned to clients. */
export interface UserDocument extends User {
  passwordHash: string;
  refreshTokenVersion: number;    // Increment on logout to invalidate all refresh tokens
  _partitionKey: string;          // = organizationId (or userId until org assigned)
}

/** JWT access token payload */
export interface JwtPayload {
  sub: string;           // userId
  email: string;
  role: UserRole;
  organizationId: string | null;
  iat?: number;
  exp?: number;
}

/** Attached to Express Request by auth middleware */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
}
