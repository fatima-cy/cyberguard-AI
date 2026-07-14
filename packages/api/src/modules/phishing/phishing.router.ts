/**
 * packages/api/src/modules/phishing/phishing.router.ts
 *
 * Mounted at /api/v1/phishing
 * Sprint 3.2 — POST /analyze, GET /analyses (history)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireOrganisation } from '../../middleware/auth.middleware';
import { validate, validateQuery, paginationSchema } from '../../middleware/validate.middleware';
import { analyzePhishing } from './phishing.service';
import { saveAnalysis, listAnalyses } from '../../repositories/phishing.repository';
import { ERROR_TYPES } from '@cyberguard/shared';

export const phishingRouter = Router();

const analyzeSchema = z.object({
  emailContent: z.string().max(20000).optional(),
  url: z.string().max(2000).optional(),
  senderDomain: z.string().max(255).optional(),
  subject: z.string().max(500).optional(),
  attachmentNames: z.array(z.string().max(255)).max(20).optional(),
}).refine(
  (data) => data.emailContent || data.url || data.senderDomain || data.subject,
  { message: 'At least one of emailContent, url, senderDomain, or subject is required' },
);

// POST /api/v1/phishing/analyze
phishingRouter.post('/analyze', requireAuth, requireOrganisation, validate(analyzeSchema), async (req: Request, res: Response) => {
  const { userId, organizationId } = req.user!;

  try {
    const analysis = await analyzePhishing(req.body, organizationId!, userId);
    const saved = await saveAnalysis(analysis);
    res.status(200).json(saved);
  } catch (err: any) {
    if (err.code === 'AI_INVALID_RESPONSE') {
      res.status(502).json({
        type: '/errors/ai-invalid-response',
        title: 'Analysis Failed',
        status: 502,
        detail: 'The AI analysis engine returned an unexpected response. Please try again.',
        instance: req.path,
      });
      return;
    }
    throw err;
  }
});

// GET /api/v1/phishing/analyses
phishingRouter.get('/analyses', requireAuth, requireOrganisation, validateQuery(paginationSchema), async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const { page, limit } = req.query as any;
  const analyses = await listAnalyses(organizationId!, Number(page), Number(limit));
  res.status(200).json({ analyses, page: Number(page), limit: Number(limit) });
});
