import { api } from './client';
import type { User, Organisation, ChatSession, ChatMessage, PhishingAnalysis, PhishingAnalysisInput, GeneratedPolicy, PolicyType, PolicySector, PolicyOrgContext } from '@cyberguard/shared';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface ActivityItem {
  type: 'chat' | 'phishing' | 'policy';
  id: string;
  title: string;
  meta: string;
  timestamp: string;
  href: string;
}

export interface DashboardSummary {
  user: User;
  organization: Organisation;
  stats: {
    conversations: number;
    phishingAnalyses: number;
    policiesGenerated: number;
    riskBreakdown: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number };
    lastActive: string | null;
  };
  recentActivity: ActivityItem[];
}

export const dashboardApi = {
  getSummary: () => api.get<DashboardSummary>('/api/v1/dashboard/summary'),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatResponse {
  response: string;
  sessionId: string;
  messageId: string;
  metadata: {
    model: string;
    tokens: { prompt: number; completion: number; total: number };
    latencyMs: number;
  };
}

export interface SessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
}

export const chatApi = {
  sendMessage: (data: { message: string; sessionId?: string }) =>
    api.post<ChatResponse>('/api/v1/cyberguard/chat', data),

  listSessions: (page = 1, limit = 50) =>
    api.get<{ sessions: ChatSession[]; page: number; limit: number }>(
      `/api/v1/cyberguard/sessions?page=${page}&limit=${limit}`,
    ),

  getSession: (sessionId: string) =>
    api.get<SessionDetail>(`/api/v1/cyberguard/sessions/${sessionId}`),

  renameSession: (sessionId: string, title: string) =>
    api.patch<{ id: string; title: string }>(
      `/api/v1/cyberguard/sessions/${sessionId}`,
      { title },
    ),

  deleteSession: (sessionId: string) =>
    api.delete<{ id: string; deleted: boolean }>(
      `/api/v1/cyberguard/sessions/${sessionId}`,
    ),
};

// ─── Phishing Analyzer (Sprint 3.2) ──────────────────────────────────────────

export const phishingApi = {
  analyze: (input: PhishingAnalysisInput) =>
    api.post<PhishingAnalysis>('/api/v1/phishing/analyze', input),

  listAnalyses: (page = 1, limit = 20) =>
    api.get<{ analyses: PhishingAnalysis[]; page: number; limit: number }>(
      `/api/v1/phishing/analyses?page=${page}&limit=${limit}`,
    ),
};

// ─── Security Policy Generator (Sprint 3.3) ──────────────────────────────────

export const policiesApi = {
  generate: (type: PolicyType, sector: PolicySector, orgContext: PolicyOrgContext) =>
    api.post<GeneratedPolicy>('/api/v1/policies/generate', {
      type, sector, organizationName: orgContext.organizationName, additionalContext: orgContext.additionalContext,
    }),

  listPolicies: (page = 1, limit = 20) =>
    api.get<{ policies: GeneratedPolicy[]; page: number; limit: number }>(
      `/api/v1/policies?page=${page}&limit=${limit}`,
    ),

  getPolicy: (id: string) => api.get<GeneratedPolicy>(`/api/v1/policies/${id}`),

  deletePolicy: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/api/v1/policies/${id}`),
};
