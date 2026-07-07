/**
 * CyberGuard AI — Chat Service
 *
 * Handles AI chat interactions via Azure OpenAI.
 * Sprint 1.5: sendChatMessage() — blocking response
 * Sprint 2.1: sendChatMessageStream() — token-by-token streaming via async generator
 *
 * @see Blueprint §6.1 — CyberGuard AI Chat Module
 */

import { getOpenAIClient } from './openai.client';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';
import type { AiRequestMetadata } from '@cyberguard/shared';

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are CyberGuard AI, an expert cybersecurity assistant specialising in African and MENA enterprise security.

Your knowledge base covers:
- Nigerian Data Protection Regulation (NDPR) and NITDA compliance requirements
- ISO 27001 information security management
- CIS Controls implementation for resource-constrained organisations
- Common cyber threats targeting African businesses (mobile money fraud, BEC, phishing)
- Practical security guidance for SMEs and enterprises in Nigeria, Ghana, Kenya, and the broader African market
- GDPR implications for African companies with EU data subjects

Your communication style:
- Be direct, practical, and actionable
- Use markdown formatting: headers (##), bullet points, bold for key terms, code blocks for commands/configs
- Acknowledge the specific constraints of African enterprises (limited budgets, intermittent connectivity, mixed technical literacy)
- Provide concrete steps, not just theory
- When discussing compliance, always reference the applicable Nigerian or regional regulation
- Flag when advice differs for small vs large organisations

Safety boundaries:
- Never provide guidance that could be used to conduct cyberattacks
- Do not generate malware, exploits, or attack tooling
- If asked about offensive techniques, redirect to defensive countermeasures
- Always recommend professional security assessment for high-risk decisions`;

// ─── Blocking response (Sprint 1.5 — kept as fallback) ───────────────────────

export interface ChatResult {
  response: string;
  metadata: AiRequestMetadata;
}

export async function sendChatMessage(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<ChatResult> {
  const client = getOpenAIClient();
  const startTime = Date.now();

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user' as const, content: message },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: config.openai.deploymentName,
      messages,
      max_completion_tokens: config.openai.maxTokens,
    });

    const latencyMs = Date.now() - startTime;
    const choice = completion.choices[0];
    const response = choice?.message?.content ?? '';
    const usage = completion.usage;

    const metadata: AiRequestMetadata = {
      model: completion.model,
      deploymentName: config.openai.deploymentName,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      latencyMs,
      success: true,
    };

    logger.info('AI chat request completed', {
      model: metadata.model,
      deployment: metadata.deploymentName,
      promptTokens: metadata.promptTokens,
      completionTokens: metadata.completionTokens,
      totalTokens: metadata.totalTokens,
      latencyMs: metadata.latencyMs,
      finishReason: choice?.finish_reason,
    });

    return { response, metadata };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;

    logger.error('AI chat request failed', {
      deployment: config.openai.deploymentName,
      latencyMs,
      errorCode: err.code ?? err.status?.toString() ?? 'UNKNOWN',
      errorMessage: err.message,
    });

    const serviceErr = new Error('AI service temporarily unavailable') as any;
    serviceErr.statusCode = 503;
    serviceErr.code = 'AI_UNAVAILABLE';
    throw serviceErr;
  }
}

// ─── Streaming response (Sprint 2.1) ─────────────────────────────────────────

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  token?: string;
  metadata?: AiRequestMetadata;
  error?: string;
}

/**
 * Async generator that yields token chunks as they arrive from OpenAI.
 * Caller is responsible for assembling the full response and persisting it.
 *
 * Usage:
 *   for await (const chunk of sendChatMessageStream(message, history)) {
 *     if (chunk.type === 'token') write(chunk.token);
 *     if (chunk.type === 'done') saveToDb(chunk.metadata);
 *   }
 */
export async function* sendChatMessageStream(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): AsyncGenerator<StreamChunk> {
  const client = getOpenAIClient();
  const startTime = Date.now();

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user' as const, content: message },
  ];

  try {
    const stream = await client.chat.completions.create({
      model: config.openai.deploymentName,
      messages,
      max_completion_tokens: config.openai.maxTokens,
      stream: true,
    });

    let fullResponse = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let modelName = config.openai.deploymentName;

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        fullResponse += token;
        yield { type: 'token', token };
      }

      // Capture usage if provided in final chunk
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
      }

      if (chunk.model) modelName = chunk.model;
    }

    const latencyMs = Date.now() - startTime;

    const metadata: AiRequestMetadata = {
      model: modelName,
      deploymentName: config.openai.deploymentName,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      latencyMs,
      success: true,
    };

    logger.info('AI stream completed', {
      model: modelName,
      latencyMs,
      promptTokens,
      completionTokens,
    });

    yield { type: 'done', metadata };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;

    logger.error('AI stream failed', {
      deployment: config.openai.deploymentName,
      latencyMs,
      errorCode: err.code ?? err.status?.toString() ?? 'UNKNOWN',
      errorMessage: err.message,
    });

    yield { type: 'error', error: 'AI service temporarily unavailable' };
  }
}
