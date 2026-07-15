/**
 * packages/shared/src/types/policies.types.ts
 * Sprint 3.3 — Security Policy Generator types.
 */

import type { ChatSource } from './chat.types';

export type PolicyType =
  | 'acceptable_use'
  | 'data_protection'
  | 'incident_response'
  | 'remote_work_security'
  | 'password_policy';

export type PolicySector =
  | 'sme'
  | 'financial_services'
  | 'healthcare'
  | 'government'
  | 'education';

export interface PolicyOrgContext {
  organizationName: string;
  additionalContext?: string; // free-text, e.g. "we allow BYOD" — optional refinement
}

export interface GeneratedPolicy {
  id: string;
  organizationId: string;
  userId: string;
  type: PolicyType;
  sector: PolicySector;
  title: string;
  content: string;          // full markdown policy document
  sources: ChatSource[];
  orgContext: PolicyOrgContext;
  createdAt: string;
}

export const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  acceptable_use: 'Acceptable Use Policy',
  data_protection: 'Data Protection Policy',
  incident_response: 'Incident Response Policy',
  remote_work_security: 'Remote Work Security Policy',
  password_policy: 'Password Policy',
};

export const POLICY_SECTOR_LABELS: Record<PolicySector, string> = {
  sme: 'SME',
  financial_services: 'Financial Services',
  healthcare: 'Healthcare',
  government: 'Government',
  education: 'Education',
};
