/**
 * packages/api/src/modules/knowledge/knowledge.search.service.ts
 * (Sprint 4.1.1 — fixed confidenceLabel to use Azure AI Search's semantic
 * rerankerScore (0-4 scale) instead of the base hybrid score (a much smaller
 * scale), which was causing every confidence label to show "Low" regardless
 * of actual grounding quality throughout Sprint 3. See computeConfidenceLabel
 * below for the full explanation and the diagnostic data that confirmed it.)
 */

import { SearchClient } from '@azure/search-documents';
import { AzureOpenAI } from 'openai';
import type { KnowledgeChunkIndexFields, AuthorityLevel } from '@cyberguard/shared';

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 3072;
const TOP_K = 5;

const AUTHORITY_RANK: Record<AuthorityLevel, number> = {
  regulatory: 5,
  standards_body: 4,
  government_advisory: 3,
  vendor_guidance: 2,
  internal_knowledge: 1,
};

export interface RetrievedChunk {
  content: string;
  documentTitle: string;
  section: string;
  version: string;
  status: KnowledgeChunkIndexFields['status'];
  sourceUrl: string;
  supersededBy: string[];
  relevanceScore: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
}

export interface SearchOptions {
  organizationId: string | null;
  includeHistorical?: boolean;
  jurisdiction?: string;
  categories?: string[];
}

export class KnowledgeSearchService {
  constructor(
    private readonly searchClient: SearchClient<KnowledgeChunkIndexFields>,
    private readonly openai: AzureOpenAI,
  ) {}

  async search(query: string, options: SearchOptions): Promise<RetrievedChunk[]> {
    const embedding = await this.embedQuery(query);

    const filterClauses: string[] = [
      `(organizationId eq null or organizationId eq '${this.escapeODataString(options.organizationId ?? '')}')`,
      options.includeHistorical ? `status ne 'deprecated'` : `status eq 'current'`,
      `verificationStatus eq 'verified'`,
    ];
    if (options.jurisdiction) {
      filterClauses.push(`jurisdiction/any(j: j eq '${this.escapeODataString(options.jurisdiction)}')`);
    }
    if (options.categories && options.categories.length > 0) {
      const categoryChecks = options.categories
        .map((c) => `category/any(cat: cat eq '${this.escapeODataString(c)}')`)
        .join(' or ');
      filterClauses.push(`(${categoryChecks})`);
    }

    const results = await this.searchClient.search(query, {
      filter: filterClauses.join(' and '),
      vectorSearchOptions: {
        queries: [
          {
            kind: 'vector',
            vector: embedding,
            fields: ['embedding'],
            kNearestNeighborsCount: 20,
          },
        ],
      },
      queryType: 'semantic',
      semanticSearchOptions: { configurationName: 'cyberguard-semantic-config' },
      scoringProfile: 'governance-boost',
      top: 20,
      select: [
        'content', 'documentTitle', 'section', 'version', 'status', 'sourceUrl',
        'supersededBy', 'priority', 'authorityLevel', 'trustScore',
      ],
    });

    const candidates: (KnowledgeChunkIndexFields & { score: number; rerankerScore?: number })[] = [];
    for await (const r of results.results) {
      candidates.push({
        ...(r.document as KnowledgeChunkIndexFields),
        score: r.score ?? 0,
        rerankerScore: (r as any).rerankerScore,
      });
    }

    candidates.sort((a, b) => {
      const authorityDiff = AUTHORITY_RANK[b.authorityLevel] - AUTHORITY_RANK[a.authorityLevel];
      if (authorityDiff !== 0) return authorityDiff;
      const trustDiff = b.trustScore - a.trustScore;
      if (trustDiff !== 0) return trustDiff;
      return b.score - a.score;
    });

    return candidates.slice(0, TOP_K).map((c) => this.toRetrievedChunk(c));
  }

  private toRetrievedChunk(c: KnowledgeChunkIndexFields & { score: number; rerankerScore?: number }): RetrievedChunk {
    return {
      content: c.content,
      documentTitle: c.documentTitle,
      section: c.section,
      version: c.version,
      status: c.status,
      sourceUrl: c.sourceUrl,
      supersededBy: c.supersededBy,
      relevanceScore: c.rerankerScore ?? c.score,
      confidenceLabel: this.computeConfidenceLabel(c.rerankerScore, c.score),
    };
  }

  /**
   * Fixed Sprint 4.1.1 — was thresholding the base hybrid `score` (r.score)
   * against 0.8/0.6, but that field is on a very different scale than those
   * cutoffs assume: real observed values across Sprint 3 testing ranged
   * 0.06–0.13 even for genuinely well-grounded, accurate results, so every
   * single confidence label shown throughout Sprint 3 was "Low" regardless
   * of actual grounding quality — not because retrieval was weak, but
   * because the wrong score was being read.
   *
   * `rerankerScore` (Azure AI Search's dedicated semantic-relevance score,
   * populated when queryType: 'semantic' is used, as it is here) is the
   * field that 0.8/0.6-style cutoffs were implicitly designed for — except
   * its real range is 0-4, not 0-1. Confirmed via live diagnostic: the same
   * queries that always showed baseScore 0.06-0.13 showed rerankerScore
   * 2.35-2.83, which is Microsoft's documented "good to excellent" range.
   *
   * Thresholds below (High >= 2.5, Medium >= 1.5) follow Azure's own
   * published guidance for interpreting semantic reranker scores, applied
   * to this deployment's real observed score distribution.
   */
  private computeConfidenceLabel(rerankerScore: number | undefined, baseScore: number): 'High' | 'Medium' | 'Low' {
    if (rerankerScore !== undefined) {
      if (rerankerScore >= 2.5) return 'High';
      if (rerankerScore >= 1.5) return 'Medium';
      return 'Low';
    }
    // Fallback for the rare case semantic reranking doesn't attach a score
    // (e.g. content too short to rerank) — base hybrid score's real range
    // observed this session, conservatively bucketed.
    if (baseScore >= 0.1) return 'Medium';
    return 'Low';
  }

  private async embedQuery(query: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data[0].embedding;
  }

  private escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
  }
}
