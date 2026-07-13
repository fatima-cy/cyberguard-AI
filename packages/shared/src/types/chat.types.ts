/**
 * CyberGuard AI — Chat Domain Types
 *
 * Shared between API and frontend.
 *
 * @see Blueprint §6.1 — CyberGuard AI Chat Module
 * @see Cosmos containers: chat_sessions, chat_messages
 *      Both use partition key /organizationId for tenant isolation.
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatSource {
  documentTitle: string;
  section: string;
  version: string;
  status: string;
  sourceUrl: string;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  historicalNotice: string | null;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  organizationId: string;
  userId: string;
  role: MessageRole;
  content: string;
  createdAt: string;        // ISO 8601
  tokens?: MessageTokens;
  sources?: ChatSource[];   // Sprint 3.1 — RAG citations, assistant messages only
}

export interface MessageTokens {
  prompt: number;
  completion: number;
  total: number;
}

export interface ChatSession {
  id: string;
  organizationId: string;
  userId: string;
  title: string;            // Auto-generated from first user message
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/** Full session with messages — returned by GET /sessions/:id */
export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}

/** AI observability metadata — logged per request, not stored in Cosmos */
export interface AiRequestMetadata {
  model: string;
  deploymentName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
}
