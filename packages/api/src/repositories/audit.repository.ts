/**
 * packages/api/src/repositories/audit.repository.ts
 * Sprint 4.2.5 — Cosmos operations for the audit_log container.
 * Partition key: /organizationId.
 */

import { v4 as uuidv4 } from 'uuid';
import { container } from '../config/db';
import { logger } from '../core/observability/logger';
import type { AuditEvent, AuditAction } from '@cyberguard/shared';

const CONTAINER = 'audit_log';

/**
 * Fire-and-forget by convention — callers should NOT await this inline with
 * the action it's logging (or if they do, should .catch() it). An audit log
 * write failing should never block or fail the actual action it's recording;
 * losing one log entry is far preferable to, say, blocking policy generation
 * because the audit container had a transient issue.
 */
export async function logAuditEvent(
  organizationId: string,
  userId: string,
  userName: string,
  action: AuditAction,
  summary: string,
  targetId?: string,
): Promise<void> {
  const event: AuditEvent = {
    id: uuidv4(),
    organizationId,
    userId,
    userName,
    action,
    summary,
    targetId,
    createdAt: new Date().toISOString(),
  };
  try {
    await container(CONTAINER).items.create<AuditEvent>(event);
  } catch (err: any) {
    logger.error('Failed to write audit log event', { organizationId, action, error: err.message });
  }
}

export async function listAuditEvents(
  organizationId: string,
  page: number = 1,
  limit: number = 50,
): Promise<AuditEvent[]> {
  const offset = (page - 1) * limit;
  const { resources } = await container(CONTAINER)
    .items.query<AuditEvent>({
      query: `SELECT * FROM c WHERE c.organizationId = @orgId
              ORDER BY c.createdAt DESC
              OFFSET @offset LIMIT @limit`,
      parameters: [
        { name: '@orgId', value: organizationId },
        { name: '@offset', value: offset },
        { name: '@limit', value: limit },
      ],
    })
    .fetchAll();
  return resources;
}
