import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../core/observability/logger';
import {
  createOrganization,
  findOrganizationByOwnerId,
  toSafeOrg,
} from '../../repositories/organizations.repository';
import { updateUser } from '../../repositories/users.repository';
import type { CreateOrganizationRequest } from './organizations.types';
import type { Organisation } from '@cyberguard/shared';

export async function createOrganizationForUser(
  userId: string,
  data: CreateOrganizationRequest,
): Promise<Organisation> {
  const existing = await findOrganizationByOwnerId(userId);
  if (existing) {
    const err = new Error('User already owns an organisation') as any;
    err.statusCode = 409;
    err.code = 'ORG_ALREADY_EXISTS';
    throw err;
  }

  const orgId = uuidv4();
  const now = new Date().toISOString();

  const orgDoc = await createOrganization({
    id: orgId,
    name: data.name,
    plan: 'free',
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
    memberCount: 1,
    settings: {
      country: data.country,
      industry: data.industry,
      timezone: data.timezone,
    },
  });

  await updateUser(userId, null, {
    organizationId: orgId,
    role: 'org_admin',
  });

  logger.info('Organisation created', { orgId, userId, name: data.name });

  return toSafeOrg(orgDoc);
}
