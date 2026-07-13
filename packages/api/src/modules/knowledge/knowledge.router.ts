/**
 * packages/api/src/modules/knowledge/knowledge.router.ts
 * (corrected: real auth middleware exports, @cyberguard/shared import)
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { KnowledgeRepository } from '../../repositories/knowledge.repository';
import { KnowledgeIngestionService } from './knowledge.ingestion.service';

export function knowledgeRouter(
  repository: KnowledgeRepository,
  ingestionService: KnowledgeIngestionService,
): Router {
  const router = Router();

  // GET /api/v1/knowledge/sources — list registry, filterable by status/jurisdiction
  router.get('/sources', requireAuth, async (req, res, next) => {
    try {
      const { status, jurisdiction, authorityLevel } = req.query;
      const sources = await repository.list({
        status: status as any,
        jurisdiction: jurisdiction as string | undefined,
        authorityLevel: authorityLevel as any,
        organizationId: null, // shared corpus only for this listing endpoint
      });
      res.json({ sources });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/knowledge/ingest — admin only (org_admin or super_admin)
  router.post('/ingest', requireAuth, requireRole('org_admin', 'super_admin'), async (req, res, next) => {
    try {
      const { documentId, blobName, confirmedLicensed } = req.body;
      if (!documentId || !blobName) {
        return res.status(400).json({ error: 'documentId and blobName are required' });
      }
      const result = await ingestionService.ingest(documentId, blobName, { confirmedLicensed });
      res.json({ documentId, ...result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
