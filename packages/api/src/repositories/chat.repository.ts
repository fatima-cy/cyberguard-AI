/**
 * CyberGuard AI — Chat Repository
 *
 * All Cosmos DB operations for chat_sessions and chat_messages containers.
 * Both containers use /organizationId as partition key for tenant isolation.
 *
 * @see Sprint 1.6
 */

import { container } from '../config/db';
import type { ChatSession, ChatMessage } from '@cyberguard/shared';

const SESSIONS = 'chat_sessions';
const MESSAGES = 'chat_messages';

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createSession(doc: ChatSession): Promise<ChatSession> {
  const { resource } = await container(SESSIONS).items.create<ChatSession>(doc);
  if (!resource) throw new Error('Failed to create chat session');
  return toSafeSession(resource);
}

export async function getSessionById(
  sessionId: string,
  organizationId: string,
): Promise<ChatSession | null> {
  try {
    const { resource } = await container(SESSIONS)
      .item(sessionId, organizationId)
      .read<ChatSession>();
    return resource ? toSafeSession(resource) : null;
  } catch (err: any) {
    if (err.code === 404) return null;
    throw err;
  }
}

export async function listSessions(
  organizationId: string,
  page: number = 1,
  limit: number = 20,
): Promise<ChatSession[]> {
  const offset = (page - 1) * limit;
  const { resources } = await container(SESSIONS)
    .items.query<ChatSession>({
      query:
        'SELECT * FROM c WHERE c.organizationId = @orgId ORDER BY c.updatedAt DESC OFFSET @offset LIMIT @limit',
      parameters: [
        { name: '@orgId', value: organizationId },
        { name: '@offset', value: offset },
        { name: '@limit', value: limit },
      ],
    })
    .fetchAll();
  return resources.map(toSafeSession);
}

export async function updateSessionMetadata(
  sessionId: string,
  organizationId: string,
  updates: { messageCount?: number; updatedAt?: string; title?: string },
): Promise<void> {
  const operations = Object.entries({
    ...updates,
    updatedAt: updates.updatedAt ?? new Date().toISOString(),
  }).map(([key, value]) => ({ op: 'set' as const, path: `/${key}`, value }));

  await container(SESSIONS).item(sessionId, organizationId).patch(operations);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(doc: ChatMessage): Promise<ChatMessage> {
  const { resource } = await container(MESSAGES).items.create<ChatMessage>(doc);
  if (!resource) throw new Error('Failed to save chat message');
  return toSafeMessage(resource);
}

export async function getMessagesBySession(
  sessionId: string,
  organizationId: string,
): Promise<ChatMessage[]> {
  const { resources } = await container(MESSAGES)
    .items.query<ChatMessage>({
      query:
        'SELECT * FROM c WHERE c.sessionId = @sessionId AND c.organizationId = @orgId ORDER BY c.createdAt ASC',
      parameters: [
        { name: '@sessionId', value: sessionId },
        { name: '@orgId', value: organizationId },
      ],
    })
    .fetchAll();
  return resources.map(toSafeMessage);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSafeSession(doc: any): ChatSession {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    userId: doc.userId,
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    messageCount: doc.messageCount,
  };
}

function toSafeMessage(doc: any): ChatMessage {
  return {
    id: doc.id,
    sessionId: doc.sessionId,
    organizationId: doc.organizationId,
    userId: doc.userId,
    role: doc.role,
    content: doc.content,
    createdAt: doc.createdAt,
    tokens: doc.tokens,
  };
}
