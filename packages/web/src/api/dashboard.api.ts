import { api } from './client';
import type { User, Organisation, ChatSession, ChatMessage } from '@cyberguard/shared';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  user: User;
  organization: Organisation;
  stats: {
    conversations: number;
    lastActive: string | null;
  };
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
