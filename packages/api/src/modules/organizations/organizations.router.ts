/**
 * CyberGuard AI — Organizations Router
 *
 * Mounted at /api/v1/organizations
 *
 * Sprint 1.4: POST / (create organization)
 * Sprint 4.2.1: Invitation management (create/list/revoke), org settings update
 * Sprint 4.2.2: Member management (list/role-change/remove)
 *
 * @see Blueprint §4.2 — Multi-Tenancy
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { createOrganizationSchema } from './organizations.types';
import { createOrganizationForUser, listMembers, changeMemberRole, removeMember } from './organizations.service';
import { findOrganizationById, updateOrganization } from '../../repositories/organizations.repository';
import { findUserById } from '../../repositories/users.repository';
import { sendInvitation, revokeInvitation, listPendingInvitations } from '../invitations/invitations.service';
import { ERROR_TYPES } from '@cyberguard/shared';

export const organizationsRouter = Router();

organizationsRouter.use(requireAuth);

// ─── POST / — Create organisation ────────────────────────────────────────────

organizationsRouter.post(
  '/',
  validate(createOrganizationSchema),
  async (req: Request, res: Response) => {
    try {
      if (req.user!.organizationId) {
        res.status(409).json({
          type: ERROR_TYPES.BAD_REQUEST,
          title: 'Organisation Already Exists',
          status: 409,
          detail: 'You are already a member of an organisation.',
          instance: req.path,
        });
        return;
      }

      const organization = await createOrganizationForUser(req.user!.userId, req.body);
      res.status(201).json({ organization });
    } catch (err: any) {
      if (err.code === 'ORG_ALREADY_EXISTS') {
        res.status(409).json({
          type: ERROR_TYPES.BAD_REQUEST,
          title: 'Organisation Already Exists',
          status: 409,
          detail: 'You already own an organisation.',
          instance: req.path,
        });
        return;
      }
      throw err;
    }
  },
);

// ─── GET / — Get current user's organisation ─────────────────────────────────

organizationsRouter.get('/', async (req: Request, res: Response) => {
  if (!req.user!.organizationId) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND,
      title: 'No Organisation',
      status: 404,
      detail: 'You are not a member of any organisation yet.',
      instance: req.path,
    });
    return;
  }

  const organization = await findOrganizationById(req.user!.organizationId);

  if (!organization) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND,
      title: 'Organisation Not Found',
      status: 404,
      detail: 'Your organisation could not be found.',
      instance: req.path,
    });
    return;
  }

  res.status(200).json({ organization });
});

// ─── PATCH / — Update organisation settings ──────────────────────────────────

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  country: z.string().min(1).max(100).optional(),
  industry: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(100).optional(),
});

organizationsRouter.patch(
  '/',
  requireRole('org_admin', 'super_admin'),
  validate(updateOrgSchema),
  async (req: Request, res: Response) => {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'No Organisation', status: 404, detail: 'You are not a member of any organisation yet.', instance: req.path });
      return;
    }
    const { name, country, industry, timezone } = req.body;
    await updateOrganization(organizationId, { name, country, industry, timezone });
    const organization = await findOrganizationById(organizationId);
    res.status(200).json({ organization });
  },
);

// ─── Invitations (Sprint 4.2.1) ───────────────────────────────────────────────

const createInvitationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(['org_admin', 'standard']),
});

organizationsRouter.post(
  '/invitations',
  requireRole('org_admin', 'super_admin'),
  validate(createInvitationSchema),
  async (req: Request, res: Response) => {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'No Organisation', status: 404, detail: 'You are not a member of any organisation yet.', instance: req.path });
      return;
    }

    const [org, inviter] = await Promise.all([
      findOrganizationById(organizationId),
      findUserById(req.user!.userId),
    ]);
    if (!org || !inviter) {
      res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Not Found', status: 404, detail: 'Organisation or user not found.', instance: req.path });
      return;
    }

    const { email, role } = req.body;
    const invitation = await sendInvitation(organizationId, org.name, req.user!.userId, inviter.name, email, role);
    res.status(201).json({ invitation });
  },
);

organizationsRouter.get(
  '/invitations',
  requireRole('org_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'No Organisation', status: 404, detail: 'You are not a member of any organisation yet.', instance: req.path });
      return;
    }
    const invitations = await listPendingInvitations(organizationId);
    res.status(200).json({ invitations });
  },
);

organizationsRouter.delete(
  '/invitations/:id',
  requireRole('org_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'No Organisation', status: 404, detail: 'You are not a member of any organisation yet.', instance: req.path });
      return;
    }
    try {
      await revokeInvitation(req.params.id, organizationId);
      res.status(200).json({ id: req.params.id, revoked: true });
    } catch (err: any) {
      if (err.code === 'INVITATION_NOT_FOUND') {
        res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Invitation Not Found', status: 404, detail: 'This invitation does not exist.', instance: req.path });
        return;
      }
      throw err;
    }
  },
);

// ─── Member Management (Sprint 4.2.2) ─────────────────────────────────────────

// GET /api/v1/organizations/members — any member can see the team list
organizationsRouter.get('/members', async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'No Organisation', status: 404, detail: 'You are not a member of any organisation yet.', instance: req.path });
    return;
  }
  const members = await listMembers(organizationId);
  res.status(200).json({ members });
});

const changeRoleSchema = z.object({ role: z.enum(['org_admin', 'standard']) });

// PATCH /api/v1/organizations/members/:userId/role — org_admin only
organizationsRouter.patch(
  '/members/:userId/role',
  requireRole('org_admin', 'super_admin'),
  validate(changeRoleSchema),
  async (req: Request, res: Response) => {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'No Organisation', status: 404, detail: 'You are not a member of any organisation yet.', instance: req.path });
      return;
    }
    try {
      await changeMemberRole(organizationId, req.params.userId, req.body.role);
      res.status(200).json({ userId: req.params.userId, role: req.body.role });
    } catch (err: any) {
      if (err.code === 'LAST_ADMIN') {
        res.status(409).json({ type: ERROR_TYPES.BAD_REQUEST, title: 'Cannot Change Role', status: 409, detail: 'This is the last admin in the organisation — promote another member first.', instance: req.path });
        return;
      }
      if (err.code === 'MEMBER_NOT_FOUND') {
        res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Member Not Found', status: 404, detail: 'This member does not exist in your organisation.', instance: req.path });
        return;
      }
      throw err;
    }
  },
);

// DELETE /api/v1/organizations/members/:userId — org_admin only
organizationsRouter.delete(
  '/members/:userId',
  requireRole('org_admin', 'super_admin'),
  async (req: Request, res: Response) => {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'No Organisation', status: 404, detail: 'You are not a member of any organisation yet.', instance: req.path });
      return;
    }
    try {
      await removeMember(organizationId, req.params.userId);
      res.status(200).json({ userId: req.params.userId, removed: true });
    } catch (err: any) {
      if (err.code === 'LAST_ADMIN') {
        res.status(409).json({ type: ERROR_TYPES.BAD_REQUEST, title: 'Cannot Remove Member', status: 409, detail: 'This is the last admin in the organisation — promote another member first.', instance: req.path });
        return;
      }
      if (err.code === 'MEMBER_NOT_FOUND') {
        res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Member Not Found', status: 404, detail: 'This member does not exist in your organisation.', instance: req.path });
        return;
      }
      throw err;
    }
  },
);
