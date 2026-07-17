import { container } from '../config/db';
import type { OrganisationDocument, Organisation } from '@cyberguard/shared';

const CONTAINER = 'organizations';

export function toSafeOrg(doc: OrganisationDocument): Organisation {
  return {
    id: doc.id,
    name: doc.name,
    plan: doc.plan,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    memberCount: doc.memberCount,
    settings: doc.settings,
  };
}

export async function findOrganizationById(orgId: string): Promise<OrganisationDocument | null> {
  try {
    const { resource } = await container(CONTAINER).item(orgId, orgId).read<OrganisationDocument>();
    return resource ?? null;
  } catch (err: any) {
    if (err.code === 404) return null;
    throw err;
  }
}

export async function findOrganizationByOwnerId(ownerId: string): Promise<OrganisationDocument | null> {
  const { resources } = await container(CONTAINER)
    .items.query<OrganisationDocument>({
      query: 'SELECT * FROM c WHERE c.ownerId = @ownerId',
      parameters: [{ name: '@ownerId', value: ownerId }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

export async function createOrganization(doc: OrganisationDocument): Promise<OrganisationDocument> {
  const { resource } = await container(CONTAINER).items.create<OrganisationDocument>(doc);
  if (!resource) throw new Error('Failed to create organization document in Cosmos');
  return resource;
}

export async function updateOrganization(
  orgId: string,
  updates: { name?: string; country?: string; industry?: string; timezone?: string },
): Promise<void> {
  const operations: { op: 'set'; path: string; value: any }[] = [];
  if (updates.name !== undefined) operations.push({ op: 'set', path: '/name', value: updates.name });
  if (updates.country !== undefined) operations.push({ op: 'set', path: '/settings/country', value: updates.country });
  if (updates.industry !== undefined) operations.push({ op: 'set', path: '/settings/industry', value: updates.industry });
  if (updates.timezone !== undefined) operations.push({ op: 'set', path: '/settings/timezone', value: updates.timezone });
  operations.push({ op: 'set', path: '/updatedAt', value: new Date().toISOString() });

  if (operations.length === 1) return;
  await container(CONTAINER).item(orgId, orgId).patch(operations);
}

export async function incrementMemberCount(orgId: string): Promise<void> {
  const org = await findOrganizationById(orgId);
  if (!org) throw new Error(`Organization ${orgId} not found for memberCount increment`);
  await container(CONTAINER).item(orgId, orgId).patch([
    { op: 'set', path: '/memberCount', value: org.memberCount + 1 },
    { op: 'set', path: '/updatedAt', value: new Date().toISOString() },
  ]);
}

/** Sprint 4.2.2 — mirrors incrementMemberCount for member removal. Floors at
 *  0 defensively (shouldn't ever go negative given the last-admin guard in
 *  organizations.service.ts, but a stale count should never crash a request). */
export async function decrementMemberCount(orgId: string): Promise<void> {
  const org = await findOrganizationById(orgId);
  if (!org) throw new Error(`Organization ${orgId} not found for memberCount decrement`);
  await container(CONTAINER).item(orgId, orgId).patch([
    { op: 'set', path: '/memberCount', value: Math.max(0, org.memberCount - 1) },
    { op: 'set', path: '/updatedAt', value: new Date().toISOString() },
  ]);
}
