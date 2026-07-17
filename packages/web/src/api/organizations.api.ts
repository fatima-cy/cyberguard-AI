import { api } from './client';
import type { Organisation, Invitation, User } from '@cyberguard/shared';

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

  // Sprint 4.2.2 — Member Management
  listMembers: () =>
    api.get<{ members: User[] }>('/api/v1/organizations/members'),

  changeMemberRole: (userId: string, role: 'org_admin' | 'standard') =>
    api.patch<{ userId: string; role: string }>(`/api/v1/organizations/members/${userId}/role`, { role }),

  removeMember: (userId: string) =>
    api.delete<{ userId: string; removed: boolean }>(`/api/v1/organizations/members/${userId}`),
};

export const invitationsApi = {
  lookup: (token: string) => api.get<InvitationLookup>(`/api/v1/invitations/${token}`, { skipAuth: true }),
};
