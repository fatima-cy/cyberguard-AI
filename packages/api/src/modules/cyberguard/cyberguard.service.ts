/**
 * CyberGuard AI — Chat Service
 *
 * Sprint 1.5: sendChatMessage() — blocking response
 * Sprint 2.1: sendChatMessageStream() — streaming via async generator
 * Sprint 2.2: Organisation context injected into system prompt
 *             stream_options.include_usage for accurate token counts
 * Sprint 3.1: RAG grounding via knowledge.search.service.ts — retrieved
 *             chunks injected into the system prompt with citation
 *             instructions; sources[] returned/yielded alongside the
 *             response for persistence and UI citation display.
 *
 * @see Blueprint §6.1 — CyberGuard AI Chat Module
 */

import { getOpenAIClient } from './openai.client';
import { getSearchClient } from '../../config/search';
import { KnowledgeSearchService, type RetrievedChunk } from '../knowledge/knowledge.search.service';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';
import type { AiRequestMetadata, KnowledgeChunkIndexFields, ChatSource } from '@cyberguard/shared';

// ─── Knowledge search service singleton ──────────────────────────────────────
// Reuses the existing getOpenAIClient() and the config/search.ts client factory
// added in Sprint 3.1 — no new client construction here, matching the pattern
// already established for the OpenAI client below.

let _knowledgeSearch: KnowledgeSearchService | null = null;
function getKnowledgeSearch(): KnowledgeSearchService {
  if (_knowledgeSearch) return _knowledgeSearch;
  _knowledgeSearch = new KnowledgeSearchService(
    getSearchClient<KnowledgeChunkIndexFields>(),
    getOpenAIClient(),
  );
  return _knowledgeSearch;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are CyberGuard AI, an expert cybersecurity assistant specialising in African and MENA enterprise security.

Your knowledge base covers:
- Nigerian data protection law — the Nigeria Data Protection Act (NDPA) 2023 and the General Application & Implementation Directive (GAID) 2025 are the current governing framework; NDPR 2019 has been superseded and should only be referenced for historical or comparative context, never as current law
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
- When discussing compliance, always reference the applicable Nigerian or regional regulation, using its current name and status (see above)
- Flag when advice differs for small vs large organisations
Safety boundaries:
- Never provide guidance that could be used to conduct cyberattacks
- Do not generate malware, exploits, or attack tooling
- If asked about offensive techniques, redirect to defensive countermeasures
- Always recommend professional security assessment for high-risk decisions`;

export interface OrgContext {
  name: string;
  industry: string;
  country: string;
  plan: string;
}

// ChatSource now lives in packages/shared/src/types/chat.types.ts (see the
// accompanying shared-package patch) so chat.repository.ts can use the same
// type when persisting/reading it — a locally-scoped type here would have
// left the repository unable to reference it without a duplicate definition.
// Re-exported so cyberguard.router.ts's existing `import { type ChatSource }
// from './cyberguard.service'` keeps working unchanged.
export type { ChatSource };

function toChatSource(c: RetrievedChunk): ChatSource {
  return {
    documentTitle: c.documentTitle,
    section: c.section,
    version: c.version,
    status: c.status,
    sourceUrl: c.sourceUrl,
    confidenceLabel: c.confidenceLabel,
    historicalNotice: c.status === 'historical'
      ? `Historical — superseded${c.supersededBy.length ? ` by ${c.supersededBy.join(', ')}` : ''}`
      : null,
  };
}

/** Heuristic for the retrieval fallback rule in retrieval-architecture.md —
 *  "historical documents surfaced only if the user explicitly asks for
 *  historical/comparative guidance." Revisit with proper intent
 *  classification if this proves too blunt — Sprint 4 backlog. */
function looksLikeHistoricalQuery(message: string): boolean {
  return /\b(used to|previously|before|old(er)? version|history|historical|compare.*(to|with).*(old|previous))\b/i.test(message);
}

/**
 * Builds the full system prompt with optional organisation context and
 * RAG-retrieved grounding chunks. When chunks are present, includes citation
 * instructions and an explicit historical-document warning. When no chunks
 * are found, tells the model to say so per the Sprint 3.1 ungrounded-response
 * success criterion.
 */
function buildSystemPrompt(orgContext?: OrgContext, chunks: RetrievedChunk[] = []): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (orgContext) {
    prompt += `
---
**Current Organisation Context:**
- Organisation: ${orgContext.name}
- Industry: ${orgContext.industry}
- Country: ${orgContext.country}
- Plan: ${orgContext.plan}

Tailor your responses to be directly relevant to this organisation's context.
When giving examples or recommendations, reference their industry (${orgContext.industry}) and country (${orgContext.country}) where appropriate.`;
  }

  if (chunks.length === 0) {
    prompt += `
---
No specific trusted sources were found for this query. Answer from general
cybersecurity knowledge, and begin your response by noting that no specific
sources were found in the knowledge base — general guidance follows.`;
    return prompt;
  }

  const context = chunks
    .map((c, i) => {
      const historicalTag = c.status === 'historical'
        ? ' [HISTORICAL — SUPERSEDED, do not present as current law/standard]'
        : '';
      return `[Source ${i + 1}: ${c.documentTitle}${c.section ? ` §${c.section}` : ''} (v${c.version})${historicalTag}]\n${c.content}`;
    })
    .join('\n\n');

  prompt += `
---
Ground your response in the following retrieved sources where relevant. Cite
them using the format "Based on: [Document Title §Section]". If a source is
marked HISTORICAL, you may reference it only for historical/comparative
context and must explicitly tell the user it has been superseded — never
present historical sources as current law, regulation, or standard.

${context}`;

  return prompt;
}

// ─── Blocking response (Sprint 1.5) ──────────────────────────────────────────

export interface ChatResult {
  response: string;
  metadata: AiRequestMetadata;
  sources: ChatSource[];
}

export async function sendChatMessage(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  orgContext?: OrgContext,
  organizationId?: string,
): Promise<ChatResult> {
  const client = getOpenAIClient();
  const startTime = Date.now();

  const retrievedChunks = await retrieveGrounding(message, organizationId);

  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(orgContext, retrievedChunks) },
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
      sourcesRetrieved: retrievedChunks.length,
    });

    return { response, metadata, sources: retrievedChunks.map(toChatSource) };
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

// ─── Streaming response (Sprint 2.1 + 2.2) ───────────────────────────────────

export interface StreamChunk {
  type: 'token' | 'sources' | 'done' | 'error';
  token?: string;
  sources?: ChatSource[];
  metadata?: AiRequestMetadata;
  error?: string;
}

export async function* sendChatMessageStream(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  orgContext?: OrgContext,
  organizationId?: string,
): AsyncGenerator<StreamChunk> {
  const client = getOpenAIClient();
  const startTime = Date.now();

  const retrievedChunks = await retrieveGrounding(message, organizationId);
  const sources = retrievedChunks.map(toChatSource);

  // Emit sources before token streaming begins — retrieval happens before
  // generation starts (not interleaved with it), so the citation block can
  // render in the UI immediately rather than waiting for the full response.
  yield { type: 'sources', sources };

  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(orgContext, retrievedChunks) },
    ...conversationHistory,
    { role: 'user' as const, content: message },
  ];

  try {
    const stream = await client.chat.completions.create({
      model: config.openai.deploymentName,
      messages,
      max_completion_tokens: config.openai.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
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
      totalTokens: promptTokens + completionTokens,
      sourcesRetrieved: retrievedChunks.length,
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

// ─── RAG retrieval helper ─────────────────────────────────────────────────────

/**
 * Retrieves grounding chunks for a query. Failures here are logged and
 * swallowed (returns empty array) rather than failing the whole chat request —
 * a knowledge-search outage should degrade to ungrounded responses, not take
 * down chat entirely. `organizationId` is required for the search service's
 * multi-tenant security filter (see knowledge.search.service.ts); if it's
 * somehow undefined here, retrieval is skipped entirely rather than risking
 * an unscoped query.
 */
async function retrieveGrounding(message: string, organizationId?: string): Promise<RetrievedChunk[]> {
  if (!organizationId) {
    logger.warn('Skipping RAG retrieval — no organizationId available on request');
    return [];
  }
  try {
    return await getKnowledgeSearch().search(message, {
      organizationId,
      includeHistorical: looksLikeHistoricalQuery(message),
    });
  } catch (err: any) {
    logger.error('Knowledge retrieval failed — continuing with ungrounded response', {
      errorMessage: err?.message,
    });
    return [];
  }
}
