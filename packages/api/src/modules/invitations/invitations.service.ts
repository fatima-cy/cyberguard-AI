/**
 * packages/api/src/modules/invitations/invitations.service.ts
 * Sprint 4.2.1 — Team Invitations.
 */

import crypto from 'crypto';
import {
  createInvitation,
  findInvitationById,
  listInvitationsByOrg,
  updateInvitationStatus,
} from '../../repositories/invitations.repository';
import { sendInvitationEmail } from '../../services/email.service';
import { logger } from '../../core/observability/logger';
import type { Invitation } from '@cyberguard/shared';

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Local token generator rather than importing auth.service.ts's — that
 *  function isn't confirmed exported, and this is small/simple enough that
 *  duplicating it is lower-risk than a cross-module import on an unverified
 *  export. Same approach (random hex token), not a different security model. */
function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function sendInvitation(
  organizationId: string,
  organizationName: string,
  invitedByUserId: string,
  invitedByName: string,
  invitedEmail: string,
  role: 'org_admin' | 'standard',
): Promise<Invitation> {
  const token = generateInviteToken();
  const now = new Date();

  const invitation: Invitation = {
    id: token,
    organizationId,
    organizationName,
    invitedEmail: invitedEmail.toLowerCase().trim(),
    invitedByUserId,
    invitedByName,
    role,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITATION_EXPIRY_MS).toISOString(),
  };

  const saved = await createInvitation(invitation);

  sendInvitationEmail(invitedEmail, organizationName, invitedByName, token).catch((err) => {
    logger.warn('Failed to send invitation email', { invitationId: token, error: err.message });
  });

  logger.info('Invitation sent', { invitationId: token, organizationId, invitedEmail });
  return saved;
}

export async function revokeInvitation(id: string, organizationId: string): Promise<void> {
  const invitation = await findInvitationById(id);
  if (!invitation || invitation.organizationId !== organizationId) {
    const err = new Error('Invitation not found') as any;
    err.statusCode = 404;
    err.code = 'INVITATION_NOT_FOUND';
    throw err;
  }
  await updateInvitationStatus(id, organizationId, 'revoked');
  logger.info('Invitation revoked', { invitationId: id, organizationId });
}

export async function listPendingInvitations(organizationId: string): Promise<Invitation[]> {
  const all = await listInvitationsByOrg(organizationId);
  const now = Date.now();
  return all.filter((inv) => {
    if (inv.status !== 'pending') return false;
    if (new Date(inv.expiresAt).getTime() < now) return false; // lazily excludes expired ones from the "pending" view
    return true;
  });
}

/**
 * Validates an invitation token and marks it accepted. Does NOT create the
 * user or update the org's memberCount — those happen in auth.service.ts's
 * registerUser() (for brand-new users) so this function stays reusable for
 * a future "accept while already logged in" flow too, without duplicating
 * the org/role assignment logic in two places.
 *
 * Deliberately checks the invited email matches the email being registered
 * — an invitation is bound to a specific address, not transferable to
 * whoever holds the link.
 */
export async function validateAndConsumeInvitation(
  token: string,
  registeringEmail: string,
): Promise<Pick<Invitation, 'organizationId' | 'organizationName' | 'role'>> {
  const invitation = await findInvitationById(token);

  if (!invitation) {
    const err = new Error('Invitation not found') as any;
    err.statusCode = 404;
    err.code = 'INVITATION_NOT_FOUND';
    throw err;
  }
  if (invitation.status !== 'pending') {
    const err = new Error(`Invitation is ${invitation.status}`) as any;
    err.statusCode = 410;
    err.code = 'INVITATION_NOT_PENDING';
    throw err;
  }
  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    await updateInvitationStatus(invitation.id, invitation.organizationId, 'expired');
    const err = new Error('Invitation has expired') as any;
    err.statusCode = 410;
    err.code = 'INVITATION_EXPIRED';
    throw err;
  }
  if (invitation.invitedEmail !== registeringEmail.toLowerCase().trim()) {
    const err = new Error('This invitation was sent to a different email address') as any;
    err.statusCode = 403;
    err.code = 'INVITATION_EMAIL_MISMATCH';
    throw err;
  }

  await updateInvitationStatus(invitation.id, invitation.organizationId, 'accepted');

  return {
    organizationId: invitation.organizationId,
    organizationName: invitation.organizationName,
    role: invitation.role,
  };
}
