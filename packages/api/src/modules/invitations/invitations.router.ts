/**
 * packages/api/src/modules/invitations/invitations.router.ts
 * Mounted at /api/v1/invitations
 * Sprint 4.2.1 — public-ish lookup endpoint. The admin-facing create/list/
 * revoke endpoints live on organizationsRouter instead (see
 * organizations.router.ts), since those need org context that already
 * exists there — this router exists specifically because looking up an
 * invitation is the one case where the caller does NOT have an account
 * yet. Actual acceptance happens inside registerUser() in
 * auth.service.ts, not here — see invitations.service.ts's
 * validateAndConsumeInvitation() doc comment for why.
 */

import { Router, type Request, type Response } from 'express';
import { findInvitationById } from '../../repositories/invitations.repository';
import { ERROR_TYPES } from '@cyberguard/shared';

export const invitationsRouter = Router();

// GET /api/v1/invitations/:token — lets the registration page show
// "You've been invited to join {orgName}" before the user submits the form.
// Deliberately unauthenticated (no account exists yet at this point) and
// returns only non-sensitive display fields, not the full invitation record.
invitationsRouter.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const invitation = await findInvitationById(token);

  if (!invitation || invitation.status !== 'pending' || new Date(invitation.expiresAt).getTime() < Date.now()) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND, title: 'Invitation Not Found', status: 404,
      detail: 'This invitation link is invalid or has expired.', instance: req.path,
    });
    return;
  }

  res.status(200).json({
    organizationName: invitation.organizationName,
    invitedEmail: invitation.invitedEmail,
    invitedByName: invitation.invitedByName,
    role: invitation.role,
  });
});
