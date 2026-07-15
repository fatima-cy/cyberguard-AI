/**
 * packages/api/src/modules/policies/policies.router.ts
 * Mounted at /api/v1/policies
 * Sprint 3.3 — POST /generate, GET /, GET /:id, DELETE /:id
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireOrganisation } from '../../middleware/auth.middleware';
import { validate, validateQuery, paginationSchema } from '../../middleware/validate.middleware';
import { generatePolicy } from './policies.service';
import { savePolicy, listPolicies, getPolicyById, deletePolicy } from '../../repositories/policies.repository';
import { ERROR_TYPES } from '@cyberguard/shared';

export const policiesRouter = Router();

const POLICY_TYPES = ['acceptable_use', 'data_protection', 'incident_response', 'remote_work_security', 'password_policy'] as const;
const POLICY_SECTORS = ['sme', 'financial_services', 'healthcare', 'government', 'education'] as const;

const generateSchema = z.object({
  type: z.enum(POLICY_TYPES),
  sector: z.enum(POLICY_SECTORS),
  organizationName: z.string().min(1).max(200),
  additionalContext: z.string().max(2000).optional(),
});

// POST /api/v1/policies/generate
policiesRouter.post('/generate', requireAuth, requireOrganisation, validate(generateSchema), async (req: Request, res: Response) => {
  const { userId, organizationId } = req.user!;
  const { type, sector, organizationName, additionalContext } = req.body;

  try {
    const policy = await generatePolicy(
      type, sector, { organizationName, additionalContext }, organizationId!, userId,
    );
    const saved = await savePolicy(policy);
    res.status(200).json(saved);
  } catch (err: any) {
    if (err.code === 'GENERATION_TIMEOUT') {
      res.status(504).json({
        type: '/errors/generation-timeout', title: 'Generation Timed Out', status: 504,
        detail: 'Policy generation exceeded the time limit. Please try again.', instance: req.path,
      });
      return;
    }
    if (err.code === 'AI_EMPTY_RESPONSE') {
      res.status(502).json({
        type: '/errors/ai-empty-response', title: 'Generation Failed', status: 502,
        detail: 'The AI returned an empty policy. Please try again.', instance: req.path,
      });
      return;
    }
    throw err;
  }
});

// GET /api/v1/policies
policiesRouter.get('/', requireAuth, requireOrganisation, validateQuery(paginationSchema), async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const { page, limit } = req.query as any;
  const policies = await listPolicies(organizationId!, Number(page), Number(limit));
  res.status(200).json({ policies, page: Number(page), limit: Number(limit) });
});

// GET /api/v1/policies/:id
policiesRouter.get('/:id', requireAuth, requireOrganisation, async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const id = req.params['id'] as string;
  const policy = await getPolicyById(id, organizationId!);
  if (!policy) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Policy Not Found', status: 404, detail: 'Policy not found.', instance: req.path });
    return;
  }
  res.status(200).json(policy);
});

// DELETE /api/v1/policies/:id
policiesRouter.delete('/:id', requireAuth, requireOrganisation, async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const id = req.params['id'] as string;
  const policy = await getPolicyById(id, organizationId!);
  if (!policy) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Policy Not Found', status: 404, detail: 'Policy not found.', instance: req.path });
    return;
  }
  await deletePolicy(id, organizationId!);
  res.status(200).json({ id, deleted: true });
});
