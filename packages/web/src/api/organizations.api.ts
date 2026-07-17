import { api } from './client';
import type { Organisation, Invitation } from '@cyberguard/shared';

export interface InvitationLookup {
  organizationName: string;
  invitedEmail: string;
  invitedByName: string;
  role: 'org_admin' | 'standard';
}

export const organizationsApi = {
  get: () => api.get<{ organization: Organisation }>('/api/v1/organizations'),

  update: (data: { name?: string; country?: string; industry?: string; timezone?: string }) =>
    api.patch<{ organization: Organisation }>('/api/v1/organizations', data),

  inviteTeammate: (data: { email: string; role: 'org_admin' | 'standard' }) =>
    api.post<{ invitation: Invitation }>('/api/v1/organizations/invitations', data),

  listPendingInvitations: () =>
    api.get<{ invitations: Invitation[] }>('/api/v1/organizations/invitations'),

  revokeInvitation: (id: string) =>
    api.delete<{ id: string; revoked: boolean }>(`/api/v1/organizations/invitations/${id}`),
};

export const invitationsApi = {
  // Unauthenticated lookup — used by the registration page to show
  // "You've been invited to join {org}" before the person has an account.
  lookup: (token: string) => api.get<InvitationLookup>(`/api/v1/invitations/${token}`, { skipAuth: true }),
};
