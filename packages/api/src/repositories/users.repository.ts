import { container } from '../config/db';
import type { UserDocument, User } from '@cyberguard/shared';

const CONTAINER = 'users';

export function toSafeUser(doc: UserDocument): User {
  return {
    id: doc.id,
    email: doc.email,
    name: doc.name,
    role: doc.role,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  const { resources } = await container(CONTAINER)
    .items.query<UserDocument>({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email.toLowerCase().trim() }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

export async function findUserById(userId: string): Promise<UserDocument | null> {
  const { resources } = await container(CONTAINER)
    .items.query<UserDocument>({
      query: 'SELECT * FROM c WHERE c.id = @userId',
      parameters: [{ name: '@userId', value: userId }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

export async function findUserByToken(
  field: 'emailVerificationToken' | 'passwordResetToken',
  token: string,
): Promise<UserDocument | null> {
  const querySpec = {
    query: `SELECT * FROM c WHERE c.${field} = @token`,
    parameters: [{ name: '@token', value: token }],
  };
  const { resources } = await container(CONTAINER)
    .items.query<UserDocument>(querySpec)
    .fetchAll();
  return resources[0] ?? null;
}

/** Sprint 4.2.2 — used by Team Member Management to list everyone in an org. */
export async function findUsersByOrganization(organizationId: string): Promise<UserDocument[]> {
  const { resources } = await container(CONTAINER)
    .items.query<UserDocument>({
      query: 'SELECT * FROM c WHERE c.organizationId = @orgId ORDER BY c.createdAt ASC',
      parameters: [{ name: '@orgId', value: organizationId }],
    })
    .fetchAll();
  return resources;
}

export async function createUser(
  doc: Omit<UserDocument, '_partitionKey'>,
): Promise<UserDocument> {
  const now = new Date().toISOString();
  const fullDoc: UserDocument = {
    ...doc,
    email: doc.email.toLowerCase().trim(),
    createdAt: now,
    updatedAt: now,
    refreshTokenVersion: 0,
    _partitionKey: doc.organizationId ?? doc.id,
  };
  const { resource } = await container(CONTAINER).items.create<UserDocument>(fullDoc);
  if (!resource) throw new Error('Failed to create user document in Cosmos');
  return resource;
}

export async function updateUser(
  userId: string,
  currentPartitionKey: string | null,
  updates: Partial<Pick<UserDocument,
    | 'organizationId' | 'role' | 'refreshTokenVersion' | 'updatedAt' | '_partitionKey'
    | 'emailVerified' | 'emailVerificationToken' | 'passwordHash'
    | 'passwordResetToken' | 'passwordResetExpiry'
  >>,
): Promise<void> {
  const isMigratingPartition =
    updates.organizationId !== undefined && currentPartitionKey !== updates.organizationId;

  if (isMigratingPartition) {
    const { resource: existing } = await container(CONTAINER)
      .item(userId, currentPartitionKey)
      .read<UserDocument>();
    if (!existing) throw new Error(`User ${userId} not found for partition migration`);
    await container(CONTAINER).item(userId, currentPartitionKey).delete();
    const { _rid, _self, _etag, _attachments, _ts, ...clean } = existing as any;
    await container(CONTAINER).items.create<UserDocument>({ ...clean, ...updates, updatedAt: new Date().toISOString() });
  } else {
    const operations = Object.entries({ ...updates, updatedAt: new Date().toISOString() })
      .map(([key, value]) => ({ op: 'set' as const, path: `/${key}`, value }));
    await container(CONTAINER).item(userId, currentPartitionKey).patch(operations);
  }
}

/** Sprint 4.2.2 — deletes a user document entirely (member removal). Requires
 *  the current partition key like updateUser does, since users are
 *  partitioned by organizationId. */
export async function deleteUser(userId: string, currentPartitionKey: string | null): Promise<void> {
  await container(CONTAINER).item(userId, currentPartitionKey).delete();
}
