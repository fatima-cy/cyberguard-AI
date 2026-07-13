/**
 * packages/api/src/modules/knowledge/knowledge.search.service.ts
 * (corrected: import from '@cyberguard/shared')
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

    const candidates: (KnowledgeChunkIndexFields & { score: number })[] = [];
    for await (const r of results.results) {
      candidates.push({ ...(r.document as KnowledgeChunkIndexFields), score: r.score ?? 0 });
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

  private toRetrievedChunk(c: KnowledgeChunkIndexFields & { score: number }): RetrievedChunk {
    return {
      content: c.content,
      documentTitle: c.documentTitle,
      section: c.section,
      version: c.version,
      status: c.status,
      sourceUrl: c.sourceUrl,
      supersededBy: c.supersededBy,
      relevanceScore: c.score,
      confidenceLabel: c.score > 0.8 ? 'High' : c.score > 0.6 ? 'Medium' : 'Low',
    };
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
