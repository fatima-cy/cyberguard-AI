/**
 * CyberGuard AI — Organizations Module Types
 * @see Sprint 1.4
 */

import { z } from 'zod';
import type { Organisation } from '@cyberguard/shared';

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Organisation name must be at least 2 characters')
    .max(100, 'Organisation name must not exceed 100 characters')
    .trim(),
  country: z.string().min(2).max(2).toUpperCase().default("NG"),
  industry: z
    .enum(['fintech', 'healthcare', 'government', 'education', 'retail', 'technology', 'other'])
    .default('other'),
  timezone: z.string().default('Africa/Lagos'),
});

export type CreateOrganizationRequest = z.infer<typeof createOrganizationSchema>;

export interface CreateOrganizationResponse {
  organization: Organisation;
}
