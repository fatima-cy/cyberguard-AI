/**
 * packages/api/src/repositories/phishing.repository.ts
 *
 * Sprint 3.2 — All Cosmos DB operations for the phishing_analyses container.
 * Partition key: /organizationId (matches chat_sessions/chat_messages convention).
 */

import { container } from '../config/db';
import type { PhishingAnalysis } from '@cyberguard/shared';

const ANALYSES = 'phishing_analyses';

export async function saveAnalysis(doc: PhishingAnalysis): Promise<PhishingAnalysis> {
  const { resource } = await container(ANALYSES).items.create<PhishingAnalysis>(doc);
  if (!resource) throw new Error('Failed to save phishing analysis');
  return toSafeAnalysis(resource);
}

export async function getAnalysisById(
  id: string,
  organizationId: string,
): Promise<PhishingAnalysis | null> {
  try {
    const { resource } = await container(ANALYSES).item(id, organizationId).read<PhishingAnalysis>();
    return resource ? toSafeAnalysis(resource) : null;
  } catch (err: any) {
    if (err.code === 404) return null;
    throw err;
  }
}

export async function listAnalyses(
  organizationId: string,
  page: number = 1,
  limit: number = 20,
): Promise<PhishingAnalysis[]> {
  const offset = (page - 1) * limit;
  const { resources } = await container(ANALYSES)
    .items.query<PhishingAnalysis>({
      query: `SELECT * FROM c
              WHERE c.organizationId = @orgId
              ORDER BY c.createdAt DESC
              OFFSET @offset LIMIT @limit`,
      parameters: [
        { name: '@orgId', value: organizationId },
        { name: '@offset', value: offset },
        { name: '@limit', value: limit },
      ],
    })
    .fetchAll();
  return resources.map(toSafeAnalysis);
}

function toSafeAnalysis(doc: any): PhishingAnalysis {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    userId: doc.userId,
    riskScore: doc.riskScore,
    riskLevel: doc.riskLevel,
    verdict: doc.verdict,
    executiveSummary: doc.executiveSummary,
    technicalSummary: doc.technicalSummary,
    indicators: doc.indicators,
    recommendedActions: doc.recommendedActions,
    sources: doc.sources ?? [],
    input: doc.input,
    createdAt: doc.createdAt,
  };
}
