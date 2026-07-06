/**
 * CyberGuard AI — Chat Router
 *
 * Mounted at /api/v1/cyberguard
 *
 * Sprint 1.5: POST /chat (single message)
 * Sprint 1.6: Session management + message persistence added
 *   - POST /chat       auto-creates session, persists messages
 *   - GET  /sessions   list sessions for org
 *   - GET  /sessions/:id  get session with full message history
 *
 * @see Blueprint §6.1 — CyberGuard AI Chat Module
 */

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { validate, validateQuery, paginationSchema } from '../../middleware/validate.middleware';
import { requireAuth, requireOrganisation } from '../../middleware/auth.middleware';
import { sendChatMessage } from './cyberguard.service';
import {
  createSession,
  getSessionById,
  listSessions,
  saveMessage,
  updateSessionMetadata,
  getMessagesBySession,
} from '../../repositories/chat.repository';
import { ERROR_TYPES } from '@cyberguard/shared';
import { config } from '../../config/env';

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
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message must not exceed 4000 characters')
    .trim(),
  sessionId: z.string().uuid('Invalid session ID').optional(),
});

// ─── POST /chat ───────────────────────────────────────────────────────────────

cyberguardRouter.post(
  '/chat',
  requireAuth,
  requireOrganisation,
  aiRateLimiter,
  validate(chatSchema),
  async (req: Request, res: Response) => {
    const { message, sessionId: existingSessionId } = req.body;
    const { userId, organizationId } = req.user!;
    const now = new Date().toISOString();

    try {
      // 1. Resolve or create session
      let session = existingSessionId
        ? await getSessionById(existingSessionId, organizationId!)
        : null;

      if (existingSessionId && !session) {
        res.status(404).json({
          type: ERROR_TYPES.NOT_FOUND,
          title: 'Session Not Found',
          status: 404,
          detail: 'The specified chat session does not exist or belongs to another organisation.',
          instance: req.path,
        });
        return;
      }

      // Load conversation history for context if continuing a session
      let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (session) {
        const previousMessages = await getMessagesBySession(session.id, organizationId!);
        conversationHistory = previousMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      }

      // 2. Call OpenAI
      const { response, metadata } = await sendChatMessage(message, conversationHistory);

      // 3. Create session if new
      if (!session) {
        // Generate title from first 60 chars of the user's message
        const title = message.length > 60 ? `${message.substring(0, 57)}...` : message;
        session = await createSession({
          id: uuidv4(),
          organizationId: organizationId!,
          userId,
          title,
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
        });
      }

      // 4. Persist user message
      await saveMessage({
        id: uuidv4(),
        sessionId: session.id,
        organizationId: organizationId!,
        userId,
        role: 'user',
        content: message,
        createdAt: now,
      });

      // 5. Persist assistant response
      const assistantMsgId = uuidv4();
      await saveMessage({
        id: assistantMsgId,
        sessionId: session.id,
        organizationId: organizationId!,
        userId,
        role: 'assistant',
        content: response,
        createdAt: new Date().toISOString(),
        tokens: {
          prompt: metadata.promptTokens,
          completion: metadata.completionTokens,
          total: metadata.totalTokens,
        },
      });

      // 6. Update session metadata
      await updateSessionMetadata(session.id, organizationId!, {
        messageCount: session.messageCount + 2,
        updatedAt: new Date().toISOString(),
      });

      res.status(200).json({
        response,
        sessionId: session.id,
        messageId: assistantMsgId,
        metadata: {
          model: metadata.model,
          tokens: {
            prompt: metadata.promptTokens,
            completion: metadata.completionTokens,
            total: metadata.totalTokens,
          },
          latencyMs: metadata.latencyMs,
        },
      });
    } catch (err: any) {
      if (err.code === 'AI_UNAVAILABLE') {
        res.status(503).json({
          type: '/errors/service-unavailable',
          title: 'AI Service Unavailable',
          status: 503,
          detail: 'The AI assistant is temporarily unavailable. Please try again in a moment.',
          instance: req.path,
        });
        return;
      }
      throw err;
    }
  },
);

// ─── GET /sessions ────────────────────────────────────────────────────────────

cyberguardRouter.get(
  '/sessions',
  requireAuth,
  requireOrganisation,
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    const { organizationId } = req.user!;
    const { page, limit } = req.query as any;

    const sessions = await listSessions(organizationId!, Number(page), Number(limit));
    res.status(200).json({ sessions, page: Number(page), limit: Number(limit) });
  },
);

// ─── GET /sessions/:id ────────────────────────────────────────────────────────

cyberguardRouter.get(
  '/sessions/:id',
  requireAuth,
  requireOrganisation,
  async (req: Request, res: Response) => {
    const { organizationId } = req.user!;
    const { id } = req.params;

    const session = await getSessionById(id, organizationId!);
    if (!session) {
      res.status(404).json({
        type: ERROR_TYPES.NOT_FOUND,
        title: 'Session Not Found',
        status: 404,
        detail: 'The requested chat session does not exist.',
        instance: req.path,
      });
      return;
    }

    const messages = await getMessagesBySession(id, organizationId!);
    res.status(200).json({ session, messages });
  },
);
