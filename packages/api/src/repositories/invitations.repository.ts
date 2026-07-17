/**
 * packages/api/src/repositories/invitations.repository.ts
 * Sprint 4.2.1 — Cosmos operations for the invitations container.
 * Partition key: /organizationId.
 */

import { container } from '../config/db';
import type { Invitation, InvitationStatus } from '@cyberguard/shared';

const CONTAINER = 'invitations';

export async function createInvitation(doc: Invitation): Promise<Invitation> {
  const { resource } = await container(CONTAINER).items.create<Invitation>(doc);
  if (!resource) throw new Error('Failed to create invitation document in Cosmos');
  return resource;
}

/** Invitations are looked up by token (=id) without knowing the org ahead of
 *  time (the whole point of the accept flow), so this queries by id rather
 *  than doing a partition-scoped point read. */
export async function findInvitationById(id: string): Promise<Invitation | null> {
  const { resources } = await container(CONTAINER)
    .items.query<Invitation>({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: id }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

export async function listInvitationsByOrg(organizationId: string): Promise<Invitation[]> {
  const { resources } = await container(CONTAINER)
    .items.query<Invitation>({
      query: 'SELECT * FROM c WHERE c.organizationId = @orgId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@orgId', value: organizationId }],
    })
    .fetchAll();
  return resources;
}

export async function updateInvitationStatus(
  id: string,
  organizationId: string,
  status: InvitationStatus,
): Promise<void> {
  await container(CONTAINER).item(id, organizationId).patch([
    { op: 'set', path: '/status', value: status },
  ]);
}
