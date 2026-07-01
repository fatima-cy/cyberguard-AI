/**
 * CyberGuard AI — Organisation Domain Types
 *
 * Shared between API and frontend.
 *
 * @see Blueprint §4.2 — Multi-Tenancy (shared infrastructure, org-scoped data)
 * @see Cosmos container: organizations (partition key: /id)
 */

export type OrganisationPlan = 'free' | 'professional' | 'enterprise';

export interface Organisation {
  id: string;
  name: string;
  plan: OrganisationPlan;
  ownerId: string;          // userId of the org_admin who created it
  createdAt: string;        // ISO 8601
  updatedAt: string;
  memberCount: number;
  settings: OrganisationSettings;
}

export interface OrganisationSettings {
  country: string;          // e.g. 'NG' — drives compliance framework defaults
  industry: string;         // e.g. 'fintech', 'healthcare', 'government'
  timezone: string;         // IANA timezone string
}

/** Cosmos document — same as Organisation for now */
export type OrganisationDocument = Organisation;
