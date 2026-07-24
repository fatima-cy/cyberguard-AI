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
import { findUserById } from '../../repositories/users.repository';
import { logAuditEvent } from '../../repositories/audit.repository';
import { generatePolicyPdf } from '../../services/pdf.service';
import { generatePolicyDocx } from '../../services/docx.service';
import { logger } from '../../core/observability/logger';
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

    findUserById(userId).then(actor => {
      logAuditEvent(organizationId!, userId, actor?.name ?? 'Unknown', 'policy.generated', `Generated a ${type.replace('_', ' ')} policy for ${sector.replace('_', ' ')}`, saved.id).catch(() => {});
    }).catch(() => {});

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

// GET /api/v1/policies/:id/export/pdf — Sprint 4.3.1
policiesRouter.get('/:id/export/pdf', requireAuth, requireOrganisation, async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const id = req.params['id'] as string;
  const policy = await getPolicyById(id, organizationId!);
  if (!policy) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Policy Not Found', status: 404, detail: 'Policy not found.', instance: req.path });
    return;
  }
  try {
    const pdfBuffer = await generatePolicyPdf(policy);
    const filename = `${policy.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(pdfBuffer);
  } catch (err: any) {
    logger.error(`Policy PDF export failed: ${err.message}`);
    res.status(500).json({ type: '/errors/pdf-generation-failed', title: 'PDF Generation Failed', status: 500, detail: 'Failed to generate the PDF. Please try again.', instance: req.path });
  }
});

// GET /api/v1/policies/:id/export/docx — Sprint 4.3.2
policiesRouter.get('/:id/export/docx', requireAuth, requireOrganisation, async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const id = req.params['id'] as string;
  const policy = await getPolicyById(id, organizationId!);
  if (!policy) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Policy Not Found', status: 404, detail: 'Policy not found.', instance: req.path });
    return;
  }
  try {
    const docxBuffer = await generatePolicyDocx(policy);
    const filename = `${policy.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(docxBuffer);
  } catch (err: any) {
    logger.error('Policy DOCX export failed', { error: err.message, stack: err.stack });
    res.status(500).json({ type: '/errors/docx-generation-failed', title: 'DOCX Generation Failed', status: 500, detail: 'Failed to generate the Word document. Please try again.', instance: req.path });
  }
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
