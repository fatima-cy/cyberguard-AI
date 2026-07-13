/**
 * packages/api/src/repositories/knowledge.repository.ts
 * (corrected: import from '@cyberguard/shared' instead of a relative cross-package path)
 */

import { Container, CosmosClient, SqlQuerySpec } from '@azure/cosmos';
import type {
  KnowledgeDocument,
  DocumentStatus,
  AuthorityLevel,
} from '@cyberguard/shared';

export class KnowledgeRepository {
  constructor(private readonly container: Container) {}

  static fromClient(client: CosmosClient, databaseId: string): KnowledgeRepository {
    return new KnowledgeRepository(client.database(databaseId).container('knowledge_documents'));
  }

  async getById(id: string): Promise<KnowledgeDocument | null> {
    try {
      const { resource } = await this.container.item(id, id).read<KnowledgeDocument>();
      return resource ?? null;
    } catch (err: any) {
      if (err.code === 404) return null;
      throw err;
    }
  }

  async getByIds(ids: string[]): Promise<KnowledgeDocument[]> {
    if (ids.length === 0) return [];
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)',
      parameters: [{ name: '@ids', value: ids }],
    };
    const { resources } = await this.container.items.query<KnowledgeDocument>(query).fetchAll();
    return resources;
  }

  async list(filter?: {
    status?: DocumentStatus;
    jurisdiction?: string;
    authorityLevel?: AuthorityLevel;
    organizationId?: string | null;
  }): Promise<KnowledgeDocument[]> {
    const clauses: string[] = [];
    const parameters: SqlQuerySpec['parameters'] = [];

    if (filter?.status) {
      clauses.push('c.status = @status');
      parameters!.push({ name: '@status', value: filter.status });
    }
    if (filter?.jurisdiction) {
      clauses.push('ARRAY_CONTAINS(c.jurisdictions, @jurisdiction)');
      parameters!.push({ name: '@jurisdiction', value: filter.jurisdiction });
    }
    if (filter?.authorityLevel) {
      clauses.push('c.trustProfile.authorityLevel = @authorityLevel');
      parameters!.push({ name: '@authorityLevel', value: filter.authorityLevel });
    }
    if (filter?.organizationId !== undefined) {
      if (filter.organizationId === null) {
        clauses.push('(NOT IS_DEFINED(c.organizationId) OR c.organizationId = null)');
      } else {
        clauses.push('c.organizationId = @organizationId');
        parameters!.push({ name: '@organizationId', value: filter.organizationId });
      }
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const query: SqlQuerySpec = { query: `SELECT * FROM c ${where}`, parameters };
    const { resources } = await this.container.items.query<KnowledgeDocument>(query).fetchAll();
    return resources;
  }

  async listDueForReview(asOf: Date = new Date()): Promise<KnowledgeDocument[]> {
    const query: SqlQuerySpec = {
      query: `SELECT * FROM c
              WHERE IS_DEFINED(c.trustProfile.nextReviewDate)
                AND c.trustProfile.nextReviewDate != null
                AND c.trustProfile.nextReviewDate <= @asOf`,
      parameters: [{ name: '@asOf', value: asOf.toISOString().slice(0, 10) }],
    };
    const { resources } = await this.container.items.query<KnowledgeDocument>(query).fetchAll();
    return resources;
  }

  async upsert(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    const { resource } = await this.container.items.upsert<KnowledgeDocument>(document);
    return resource as unknown as KnowledgeDocument;
  }

  async recordIngestion(id: string, chunkCount: number, ingestedAt: string = new Date().toISOString()): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`[knowledge.repository] cannot record ingestion for unknown document id: ${id}`);
    }
    await this.container.item(id, id).patch([
      { op: 'replace', path: '/chunkCount', value: chunkCount },
      { op: 'replace', path: '/lastIngestedAt', value: ingestedAt },
    ]);
  }

  async resolveLatestVersion(id: string): Promise<KnowledgeDocument | null> {
    let current = await this.getById(id);
    let hops = 0;
    while (current && current.supersededBy.length > 0 && hops < 10) {
      const next = await this.getById(current.supersededBy[0]);
      if (!next) break;
      current = next;
      hops += 1;
    }
    return current;
  }
}
