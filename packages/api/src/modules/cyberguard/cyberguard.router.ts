/**
 * CyberGuard AI — Chat Router
 *
 * Mounted at /api/v1/cyberguard
 *
 * Sprint 1.5: POST /chat  — single message, blocking response
 * Sprint 1.6: Sessions and message persistence added
 *
 * Rate limit: 20 requests/minute per user (separate from general 60/min limit)
 *
 * @see Blueprint §6.1 — CyberGuard AI Chat Module
 */

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth, requireOrganisation } from '../../middleware/auth.middleware';
import { sendChatMessage } from './cyberguard.service';
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
    detail: 'You have exceeded the AI chat rate limit (20 requests/minute). Please wait before sending another message.',
  },
  skip: () => config.app.isTest,
});

// ─── Request schema ───────────────────────────────────────────────────────────

const chatSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message must not exceed 4000 characters')
    .trim(),
  sessionId: z.string().uuid('Invalid session ID').optional(),
});

// ─── POST /chat ───────────────────────────────────────────────────────────────

/**
 * Send a message to CyberGuard AI and receive a response.
 *
 * Body: { message: string, sessionId?: string }
 * Response 200: { response: string, sessionId: string, metadata: AiRequestMetadata }
 *
 * Sprint 1.6 will add: session creation, message persistence, conversation history
 */
cyberguardRouter.post(
  '/chat',
  requireAuth,
  requireOrganisation,
  aiRateLimiter,
  validate(chatSchema),
  async (req: Request, res: Response) => {
    try {
      const { message, sessionId } = req.body;

      const { response, metadata } = await sendChatMessage(message);

      res.status(200).json({
        response,
        sessionId: sessionId ?? null, // Sprint 1.6 will auto-create sessions
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
