/**
 * packages/api/src/modules/dashboard/dashboard.router.ts
 *
 * Mounted at /api/v1/dashboard
 *
 * Sprint 1.7: GET /summary
 * Sprint 4.1: Extended stats to cover phishing analyses and generated
 * policies (previously chat-only), plus a unified cross-module recent
 * activity feed, for a SOC-style dashboard.
 *
 * @see Blueprint §5.1 — Dashboard Module
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth, requireOrganisation } from '../../middleware/auth.middleware';
import { findUserById } from '../../repositories/users.repository';
import { findOrganizationById } from '../../repositories/organizations.repository';
import { listSessions } from '../../repositories/chat.repository';
import { listAnalyses } from '../../repositories/phishing.repository';
import { listPolicies } from '../../repositories/policies.repository';
import { toSafeUser } from '../../repositories/users.repository';
import { toSafeOrg } from '../../repositories/organizations.repository';
import { ERROR_TYPES } from '@cyberguard/shared';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.use(requireOrganisation);

type ActivityItem = {
  type: 'chat' | 'phishing' | 'policy';
  id: string;
  title: string;
  meta: string;
  timestamp: string;
  href: string;
};

// ─── GET /summary ─────────────────────────────────────────────────────────────

/**
 * Returns a summary of the authenticated user's workspace.
 *
 * Response: {
 *   user: { id, name, email, role },
 *   organization: { id, name, plan, memberCount },
 *   stats: {
 *     conversations: number,
 *     phishingAnalyses: number,
 *     policiesGenerated: number,
 *     riskBreakdown: { LOW, MEDIUM, HIGH, CRITICAL },
 *     lastActive: string | null
 *   },
 *   recentActivity: ActivityItem[]  // unified across chat/phishing/policies, newest first
 * }
 */
dashboardRouter.get('/summary', async (req: Request, res: Response) => {
  const { userId, organizationId } = req.user!;

  const [userDoc, orgDoc] = await Promise.all([
    findUserById(userId),
    findOrganizationById(organizationId!),
  ]);

  if (!userDoc) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND, title: 'User Not Found', status: 404,
      detail: 'Your user account could not be found.', instance: req.path,
    });
    return;
  }
  if (!orgDoc) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND, title: 'Organisation Not Found', status: 404,
      detail: 'Your organisation could not be found.', instance: req.path,
    });
    return;
  }

  // Fetch enough of each to compute accurate totals and a merged recent-activity
  // feed. 1000-item caps match the existing pattern already used for sessions —
  // fine at current scale; revisit with a dedicated count query if any org's
  // volume grows large enough to make this expensive (Sprint 4.2+ concern, not now).
  const [allSessions, allAnalyses, allPolicies] = await Promise.all([
    listSessions(organizationId!, 1, 1000),
    listAnalyses(organizationId!, 1, 1000),
    listPolicies(organizationId!, 1, 1000),
  ]);

  const riskBreakdown = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const a of allAnalyses) {
    riskBreakdown[a.riskLevel] = (riskBreakdown[a.riskLevel] ?? 0) + 1;
  }

  const activity: ActivityItem[] = [
    ...allSessions.map((s): ActivityItem => ({
      type: 'chat', id: s.id, title: s.title,
      meta: `${s.messageCount} messages`, timestamp: s.updatedAt, href: `/chat/${s.id}`,
    })),
    ...allAnalyses.map((a): ActivityItem => ({
      type: 'phishing', id: a.id, title: a.verdict.slice(0, 60),
      meta: a.riskLevel, timestamp: a.createdAt, href: `/phishing`,
    })),
    ...allPolicies.map((p): ActivityItem => ({
      type: 'policy', id: p.id, title: p.title,
      meta: p.sector, timestamp: p.createdAt, href: `/policies`,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const lastActive = activity[0]?.timestamp ?? null;

  res.status(200).json({
    user: toSafeUser(userDoc),
    organization: toSafeOrg(orgDoc),
    stats: {
      conversations: allSessions.length,
      phishingAnalyses: allAnalyses.length,
      policiesGenerated: allPolicies.length,
      riskBreakdown,
      lastActive,
    },
    recentActivity: activity.slice(0, 8),
  });
});
