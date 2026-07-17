import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../core/observability/logger';
import {
  createOrganization,
  findOrganizationByOwnerId,
  toSafeOrg,
  decrementMemberCount,
} from '../../repositories/organizations.repository';
import { updateUser, findUsersByOrganization, deleteUser, toSafeUser } from '../../repositories/users.repository';
import type { CreateOrganizationRequest } from './organizations.types';
import type { Organisation, User } from '@cyberguard/shared';

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

// ─── Member Management (Sprint 4.2.2) ─────────────────────────────────────────

export async function listMembers(organizationId: string): Promise<User[]> {
  const docs = await findUsersByOrganization(organizationId);
  return docs.map(toSafeUser);
}

/** Both role changes and removal need this same guard: an org can never end
 *  up with zero org_admins, since there'd be no one left who could invite,
 *  manage, or recover the workspace. Counts admins EXCLUDING the target,
 *  since we're checking what the org would look like after the action. */
async function assertNotLastAdmin(organizationId: string, targetUserId: string): Promise<void> {
  const members = await findUsersByOrganization(organizationId);
  const target = members.find(m => m.id === targetUserId);
  if (!target) {
    const err = new Error('Member not found') as any;
    err.statusCode = 404;
    err.code = 'MEMBER_NOT_FOUND';
    throw err;
  }
  if (target.role !== 'org_admin') return; // not an admin — no guard needed

  const remainingAdmins = members.filter(m => m.id !== targetUserId && m.role === 'org_admin').length;
  if (remainingAdmins === 0) {
    const err = new Error('Cannot remove the last admin from an organisation') as any;
    err.statusCode = 409;
    err.code = 'LAST_ADMIN';
    throw err;
  }
}

export async function changeMemberRole(
  organizationId: string,
  targetUserId: string,
  newRole: 'org_admin' | 'standard',
): Promise<void> {
  await assertNotLastAdmin(organizationId, targetUserId);
  await updateUser(targetUserId, organizationId, { role: newRole });
  logger.info('Member role changed', { organizationId, targetUserId, newRole });
}

export async function removeMember(organizationId: string, targetUserId: string): Promise<void> {
  await assertNotLastAdmin(organizationId, targetUserId);
  await deleteUser(targetUserId, organizationId);
  await decrementMemberCount(organizationId);
  logger.info('Member removed', { organizationId, targetUserId });
}
