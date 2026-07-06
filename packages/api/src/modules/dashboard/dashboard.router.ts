/**
 * CyberGuard AI — Dashboard Router
 *
 * Mounted at /api/v1/dashboard
 *
 * Sprint 1.7: GET /summary
 * Returns user profile, organisation details, and key stats.
 *
 * @see Blueprint §5.1 — Dashboard Module
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth, requireOrganisation } from '../../middleware/auth.middleware';
import { findUserById } from '../../repositories/users.repository';
import { findOrganizationById } from '../../repositories/organizations.repository';
import { listSessions } from '../../repositories/chat.repository';
import { toSafeUser } from '../../repositories/users.repository';
import { toSafeOrg } from '../../repositories/organizations.repository';
import { ERROR_TYPES } from '@cyberguard/shared';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.use(requireOrganisation);

// ─── GET /summary ─────────────────────────────────────────────────────────────

/**
 * Returns a summary of the authenticated user's workspace.
 *
 * Response: {
 *   user: { id, name, email, role },
 *   organization: { id, name, plan, memberCount },
 *   stats: { conversations: number, lastActive: string | null }
 * }
 */
dashboardRouter.get('/summary', async (req: Request, res: Response) => {
  const { userId, organizationId } = req.user!;

  // Run all reads in parallel
  const [userDoc, orgDoc, sessions] = await Promise.all([
    findUserById(userId),
    findOrganizationById(organizationId!),
    listSessions(organizationId!, 1, 1), // just need the most recent for lastActive
  ]);

  if (!userDoc) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND,
      title: 'User Not Found',
      status: 404,
      detail: 'Your user account could not be found.',
      instance: req.path,
    });
    return;
  }

  if (!orgDoc) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND,
      title: 'Organisation Not Found',
      status: 404,
      detail: 'Your organisation could not be found.',
      instance: req.path,
    });
    return;
  }

  // Get total conversation count
  const allSessions = await listSessions(organizationId!, 1, 1000);

  res.status(200).json({
    user: toSafeUser(userDoc),
    organization: toSafeOrg(orgDoc),
    stats: {
      conversations: allSessions.length,
      lastActive: allSessions[0]?.updatedAt ?? null,
    },
  });
});
