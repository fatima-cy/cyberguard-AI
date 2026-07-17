/**
 * packages/shared/src/types/invitation.types.ts
 * Sprint 4.2.1 — Team Invitations.
 */

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;              // = the invite token
  organizationId: string;
  organizationName: string; // denormalized for display without a join
  invitedEmail: string;
  invitedByUserId: string;
  invitedByName: string;    // denormalized for display
  role: 'org_admin' | 'standard';
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}
