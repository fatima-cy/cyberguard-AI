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
