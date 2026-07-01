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

export async function findUserById(
  userId: string,
  partitionKey: string,
): Promise<UserDocument | null> {
  try {
    const { resource } = await container(CONTAINER)
      .item(userId, partitionKey)
      .read<UserDocument>();
    return resource ?? null;
  } catch (err: any) {
    if (err.code === 404) return null;
    throw err;
  }
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
  partitionKey: string,
  updates: Partial<Pick<UserDocument, 'organizationId' | 'role' | 'refreshTokenVersion' | 'updatedAt' | '_partitionKey'>>,
): Promise<void> {
  const operations = Object.entries({ ...updates, updatedAt: new Date().toISOString() }).map(
    ([key, value]) => ({ op: 'set' as const, path: `/${key}`, value }),
  );
  await container(CONTAINER).item(userId, partitionKey).patch(operations);
}
