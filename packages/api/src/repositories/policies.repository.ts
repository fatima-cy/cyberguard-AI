/**
 * packages/api/src/repositories/policies.repository.ts
 * Sprint 3.3 — Cosmos operations for the generated_policies container.
 * Partition key: /organizationId.
 */

import { container } from '../config/db';
import type { GeneratedPolicy } from '@cyberguard/shared';

const POLICIES = 'generated_policies';

export async function savePolicy(doc: GeneratedPolicy): Promise<GeneratedPolicy> {
  const { resource } = await container(POLICIES).items.create<GeneratedPolicy>(doc);
  if (!resource) throw new Error('Failed to save generated policy');
  return toSafePolicy(resource);
}

export async function getPolicyById(id: string, organizationId: string): Promise<GeneratedPolicy | null> {
  try {
    const { resource } = await container(POLICIES).item(id, organizationId).read<GeneratedPolicy>();
    return resource ? toSafePolicy(resource) : null;
  } catch (err: any) {
    if (err.code === 404) return null;
    throw err;
  }
}

export async function listPolicies(
  organizationId: string,
  page: number = 1,
  limit: number = 20,
): Promise<GeneratedPolicy[]> {
  const offset = (page - 1) * limit;
  const { resources } = await container(POLICIES)
    .items.query<GeneratedPolicy>({
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
  return resources.map(toSafePolicy);
}

export async function deletePolicy(id: string, organizationId: string): Promise<void> {
  await container(POLICIES).item(id, organizationId).delete();
}

function toSafePolicy(doc: any): GeneratedPolicy {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    userId: doc.userId,
    type: doc.type,
    sector: doc.sector,
    title: doc.title,
    content: doc.content,
    sources: doc.sources ?? [],
    orgContext: doc.orgContext,
    createdAt: doc.createdAt,
  };
}
