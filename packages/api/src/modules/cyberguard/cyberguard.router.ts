/**
 * CyberGuard AI — Chat Router
 *
 * Mounted at /api/v1/cyberguard
 *
 * Sprint 1.5: POST /chat
 * Sprint 1.6: GET /sessions, GET /sessions/:id
 * Sprint 2.1: POST /chat/stream
 * Sprint 2.2: Org context
 * Sprint 2.3: PATCH /sessions/:id (rename), DELETE /sessions/:id (soft delete)
 */

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { validate, validateQuery, paginationSchema } from '../../middleware/validate.middleware';
import { requireAuth, requireOrganisation } from '../../middleware/auth.middleware';
import { sendChatMessage, sendChatMessageStream, type OrgContext } from './cyberguard.service';
import {
  createSession,
  getSessionById,
  listSessions,
  saveMessage,
  updateSessionMetadata,
  getMessagesBySession,
  renameSession,
  deleteSession,
} from '../../repositories/chat.repository';
import { findOrganizationById } from '../../repositories/organizations.repository';
import { ERROR_TYPES } from '@cyberguard/shared';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';

export const cyberguardRouter = Router();

// ─── Per-user AI rate limiter ─────────────────────────────────────────────────

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'unknown',
  message: {
    type: ERROR_TYPES.RATE_LIMIT_EXCEEDED,
    title: 'Too Many Requests',
    status: 429,
    detail: 'You have exceeded the AI chat rate limit (20 requests/minute).',
  },
  skip: () => config.app.isTest,
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

const chatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000).trim(),
  sessionId: z.string().uuid().optional(),
});

const renameSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(100, 'Title too long').trim(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrgContext(organizationId: string): Promise<OrgContext | undefined> {
  try {
    const org = await findOrganizationById(organizationId);
    if (!org) return undefined;
    return { name: org.name, industry: org.settings.industry, country: org.settings.country, plan: org.plan };
  } catch { return undefined; }
}

async function resolveSession(existingSessionId: string | undefined, userId: string, organizationId: string, message: string) {
  if (existingSessionId) return getSessionById(existingSessionId, organizationId);
  const title = message.length > 60 ? `${message.substring(0, 57)}...` : message;
  const now = new Date().toISOString();
  return createSession({ id: uuidv4(), organizationId, userId, title, createdAt: now, updatedAt: now, messageCount: 0 });
}

async function persistMessages(sessionId: string, organizationId: string, userId: string, userMessage: string, assistantResponse: string, tokens: { prompt: number; completion: number; total: number }, currentMessageCount: number): Promise<string> {
  const now = new Date().toISOString();
  const assistantMsgId = uuidv4();
  await saveMessage({ id: uuidv4(), sessionId, organizationId, userId, role: 'user', content: userMessage, createdAt: now });
  await saveMessage({ id: assistantMsgId, sessionId, organizationId, userId, role: 'assistant', content: assistantResponse, createdAt: new Date().toISOString(), tokens: { prompt: tokens.prompt, completion: tokens.completion, total: tokens.total } });
  await updateSessionMetadata(sessionId, organizationId, { messageCount: currentMessageCount + 2, updatedAt: new Date().toISOString() });
  return assistantMsgId;
}

// ─── POST /chat/stream ────────────────────────────────────────────────────────

cyberguardRouter.post('/chat/stream', requireAuth, requireOrganisation, aiRateLimiter, validate(chatSchema), async (req: Request, res: Response) => {
  const { message, sessionId: existingSessionId } = req.body;
  const { userId, organizationId } = req.user!;

  const [orgContext, session] = await Promise.all([
    getOrgContext(organizationId!),
    resolveSession(existingSessionId, userId, organizationId!, message),
  ]);

  if (existingSessionId && !session) {
    res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Session Not Found', status: 404, detail: 'The specified chat session does not exist.', instance: req.path });
    return;
  }

  const previousMessages = session && existingSessionId ? await getMessagesBySession(session.id, organizationId!) : [];
  const conversationHistory = previousMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId: session!.id })}\n\n`);

  let fullResponse = '';
  let streamMetadata: any = null;

  try {
    for await (const chunk of sendChatMessageStream(message, conversationHistory, orgContext)) {
      if (req.socket.destroyed) break;
      if (chunk.type === 'token') { fullResponse += chunk.token; res.write(`data: ${JSON.stringify({ type: 'token', token: chunk.token })}\n\n`); }
      if (chunk.type === 'done') streamMetadata = chunk.metadata;
      if (chunk.type === 'error') { res.write(`data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`); res.end(); return; }
    }

    const tokens = { prompt: streamMetadata?.promptTokens ?? 0, completion: streamMetadata?.completionTokens ?? 0, total: streamMetadata?.totalTokens ?? 0 };
    const assistantMsgId = await persistMessages(session!.id, organizationId!, userId, message, fullResponse, tokens, session!.messageCount);

    res.write(`data: ${JSON.stringify({ type: 'done', sessionId: session!.id, messageId: assistantMsgId, metadata: { model: streamMetadata?.model ?? config.openai.deploymentName, tokens, latencyMs: streamMetadata?.latencyMs ?? 0 } })}\n\n`);
  } catch { res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`); }
  finally { res.end(); }
});

// ─── POST /chat (blocking fallback) ──────────────────────────────────────────

cyberguardRouter.post('/chat', requireAuth, requireOrganisation, aiRateLimiter, validate(chatSchema), async (req: Request, res: Response) => {
  const { message, sessionId: existingSessionId } = req.body;
  const { userId, organizationId } = req.user!;
  const now = new Date().toISOString();

  try {
    const [orgContext, sessionResult] = await Promise.all([
      getOrgContext(organizationId!),
      existingSessionId ? getSessionById(existingSessionId, organizationId!) : Promise.resolve(null),
    ]);

    let session = sessionResult;
    if (existingSessionId && !session) { res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Session Not Found', status: 404, detail: 'Session not found.', instance: req.path }); return; }

    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (session) { const prev = await getMessagesBySession(session.id, organizationId!); conversationHistory = prev.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })); }

    const { response, metadata } = await sendChatMessage(message, conversationHistory, orgContext);

    if (!session) {
      const title = message.length > 60 ? `${message.substring(0, 57)}...` : message;
      session = await createSession({ id: uuidv4(), organizationId: organizationId!, userId, title, createdAt: now, updatedAt: now, messageCount: 0 });
    }

    const tokens = { prompt: metadata.promptTokens, completion: metadata.completionTokens, total: metadata.totalTokens };
    const assistantMsgId = await persistMessages(session.id, organizationId!, userId, message, response, tokens, session.messageCount);
    res.status(200).json({ response, sessionId: session.id, messageId: assistantMsgId, metadata: { model: metadata.model, tokens, latencyMs: metadata.latencyMs } });
  } catch (err: any) {
    if (err.code === 'AI_UNAVAILABLE') { res.status(503).json({ type: '/errors/service-unavailable', title: 'AI Service Unavailable', status: 503, detail: 'AI temporarily unavailable.', instance: req.path }); return; }
    throw err;
  }
});

// ─── GET /sessions ────────────────────────────────────────────────────────────

cyberguardRouter.get('/sessions', requireAuth, requireOrganisation, validateQuery(paginationSchema), async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const { page, limit } = req.query as any;
  const sessions = await listSessions(organizationId!, Number(page), Number(limit));
  res.status(200).json({ sessions, page: Number(page), limit: Number(limit) });
});

// ─── GET /sessions/:id ────────────────────────────────────────────────────────

cyberguardRouter.get('/sessions/:id', requireAuth, requireOrganisation, async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const id = req.params['id'] as string;
  const session = await getSessionById(id, organizationId!);
  if (!session) { res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Session Not Found', status: 404, detail: 'Session not found.', instance: req.path }); return; }
  const messages = await getMessagesBySession(id, organizationId!);
  res.status(200).json({ session, messages });
});

// ─── PATCH /sessions/:id — Rename ────────────────────────────────────────────

cyberguardRouter.patch('/sessions/:id', requireAuth, requireOrganisation, validate(renameSchema), async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const id = req.params['id'] as string;
  const { title } = req.body;

  const session = await getSessionById(id, organizationId!);
  if (!session) { res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Session Not Found', status: 404, detail: 'Session not found.', instance: req.path }); return; }

  await renameSession(id, organizationId!, title);
  logger.info('Session renamed', { sessionId: id, userId: req.user!.userId });
  res.status(200).json({ id, title });
});

// ─── DELETE /sessions/:id — Soft delete ──────────────────────────────────────

cyberguardRouter.delete('/sessions/:id', requireAuth, requireOrganisation, async (req: Request, res: Response) => {
  const { organizationId } = req.user!;
  const id = req.params['id'] as string;

  const session = await getSessionById(id, organizationId!);
  if (!session) { res.status(404).json({ type: ERROR_TYPES.NOT_FOUND, title: 'Session Not Found', status: 404, detail: 'Session not found.', instance: req.path }); return; }

  await deleteSession(id, organizationId!);
  logger.info('Session deleted', { sessionId: id, userId: req.user!.userId });
  res.status(200).json({ id, deleted: true });
});
