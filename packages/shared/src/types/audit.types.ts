/**
 * packages/shared/src/types/audit.types.ts
 * Sprint 4.2.5 — Audit Log.
 */

export type AuditAction =
  | 'organization.updated'
  | 'invitation.sent'
  | 'invitation.revoked'
  | 'member.role_changed'
  | 'member.removed'
  | 'policy.generated'
  | 'phishing.analyzed';

export interface AuditEvent {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;   // denormalized so the feed doesn't need a join per row
  action: AuditAction;
  summary: string;    // human-readable, e.g. "Invited jane@company.com as Standard"
  targetId?: string;  // e.g. the invited email, the affected member's userId, the policy id
  createdAt: string;
}
