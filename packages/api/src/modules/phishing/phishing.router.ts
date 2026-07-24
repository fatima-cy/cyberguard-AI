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
import { findUserById } from '../../repositories/users.repository';
import { logAuditEvent } from '../../repositories/audit.repository';
import { generatePhishingReportPdf } from '../../services/pdf.service';
import { generatePhishingReportDocx } from '../../services/docx.service';
import { getAnalysisById } from '../../repositories/phishing.repository';
import { logger } from '../../core/observability/logger';
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

    findUserById(userId).then(actor => {
      logAuditEvent(organizationId!, userId, actor?.name ?? 'Unknown', 'phishing.analyzed', `Ran a phishing analysis — result: ${saved.riskLevel}`, saved.id).catch(() => {});
    }).catch(() => {});

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

// GET /api/v1/phishing/analyses/:id/export/pdf — Sprint 4.3.3
phishingRouter.get('/analyses/:id/export/pdf', requireAuth, requireOrganisation, async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const analysis = await getAnalysisById(req.params.id, organizationId!);
  if (!analysis) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Analysis Not Found', status: 404, detail: 'Analysis not found.', instance: req.path });
    return;
  }
  try {
    const pdfBuffer = await generatePhishingReportPdf(analysis);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="phishing-analysis-${analysis.id.slice(0, 8)}.pdf"`);
    res.status(200).send(pdfBuffer);
  } catch (err: any) {
    logger.error(`Phishing report PDF export failed: ${err.message}`);
    res.status(500).json({ type: '/errors/pdf-generation-failed', title: 'PDF Generation Failed', status: 500, detail: 'Failed to generate the PDF. Please try again.', instance: req.path });
  }
});

// GET /api/v1/phishing/analyses/:id/export/docx — Sprint 4.3.3
phishingRouter.get('/analyses/:id/export/docx', requireAuth, requireOrganisation, async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const analysis = await getAnalysisById(req.params.id, organizationId!);
  if (!analysis) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Analysis Not Found', status: 404, detail: 'Analysis not found.', instance: req.path });
    return;
  }
  try {
    const docxBuffer = await generatePhishingReportDocx(analysis);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="phishing-analysis-${analysis.id.slice(0, 8)}.docx"`);
    res.status(200).send(docxBuffer);
  } catch (err: any) {
    logger.error('Phishing report DOCX export failed', { error: err.message, stack: err.stack });
    res.status(500).json({ type: '/errors/docx-generation-failed', title: 'DOCX Generation Failed', status: 500, detail: 'Failed to generate the Word document. Please try again.', instance: req.path });
  }
});
