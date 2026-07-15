/**
 * packages/api/src/modules/policies/policies.service.ts
 *
 * Sprint 3.3 — Security Policy Generator.
 * Reuses Sprint 3.1's KnowledgeSearchService and OpenAI client, same as
 * Sprint 3.2's phishing analyzer — no new Azure infrastructure.
 *
 * Deliberately uses UNSCOPED search (no `categories` filter), unlike the
 * phishing analyzer. That fix existed because phishing needs OWASP/CISA
 * technical guidance outranking GAID's higher authority tier. Policy
 * generation is the opposite case: GAID/NDPA/ISO 27001 SHOULD outrank
 * lower-authority sources here, since these are compliance documents that
 * need to cite actual regulatory clauses. The 7-step precedence order's
 * authority-first ranking is correct as-is for this module.
 */

import { v4 as uuidv4 } from 'uuid';
import { getOpenAIClient } from '../cyberguard/openai.client';
import { getSearchClient } from '../../config/search';
import { KnowledgeSearchService } from '../knowledge/knowledge.search.service';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';
import type {
  PolicyType,
  PolicySector,
  PolicyOrgContext,
  GeneratedPolicy,
  ChatSource,
  KnowledgeChunkIndexFields,
} from '@cyberguard/shared';
import { POLICY_TYPE_LABELS, POLICY_SECTOR_LABELS } from '@cyberguard/shared';

let _knowledgeSearch: KnowledgeSearchService | null = null;
function getKnowledgeSearch(): KnowledgeSearchService {
  if (_knowledgeSearch) return _knowledgeSearch;
  _knowledgeSearch = new KnowledgeSearchService(getSearchClient<KnowledgeChunkIndexFields>(), getOpenAIClient());
  return _knowledgeSearch;
}

// Reasoning models (this deployment: gpt-chat-latest) consume completion
// tokens on internal reasoning BEFORE emitting any visible output — confirmed
// via diagnostic: a 2048-token budget (fine for short chat replies) was
// entirely consumed by reasoning_tokens, leaving zero for the actual policy
// text (finish_reason: "length", content: ""). Policy documents need a much
// larger budget to cover both reasoning overhead and a full multi-section
// document. This is intentionally NOT config.openai.maxTokens — that default
// serves short chat replies correctly and shouldn't change for every module.
const POLICY_MAX_COMPLETION_TOKENS = 16000;

// Raised from the Sprint 3 plan's original 30s spec after the diagnostic above
// showed 23.8s consumed producing ONLY 2048 reasoning tokens with zero visible
// output. A full policy document needs meaningfully more total tokens than
// that, so 30s was never going to be achievable once we understood the actual
// per-token latency of this reasoning-model deployment. Flagged to the CTO as
// a spec correction, not a silent scope change — see Sprint 3.3 report.
const GENERATION_TIMEOUT_MS = 90000;

const SECTOR_GUIDANCE: Record<PolicySector, string> = {
  sme: 'Keep language accessible and avoid assuming a dedicated security team exists. Prioritize low-cost, high-impact controls.',
  financial_services: 'Reference stricter controls consistent with financial-sector risk (fraud, mobile money, third-party payment processors). Assume regulatory scrutiny is high.',
  healthcare: 'Emphasize patient data confidentiality and special-category personal data handling. Assume health records are especially sensitive under NDPA.',
  government: 'Emphasize public accountability, records retention, and formal approval/change-control processes.',
  education: 'Address student/minor data protection specifically, and assume mixed technical literacy among staff and students.',
};

function buildPolicyPrompt(
  type: PolicyType,
  sector: PolicySector,
  orgContext: PolicyOrgContext,
  chunks: Awaited<ReturnType<KnowledgeSearchService['search']>>,
): string {
  const groundingBlock = chunks.length > 0
    ? `\n\nGround the policy in the following retrieved regulatory/standards sources. Cite specific clauses/sections where the policy text draws directly from them, using the format "[Document Title §Section]" inline:\n\n${chunks.map((c, i) => `[${i + 1}: ${c.documentTitle}${c.section ? ` §${c.section}` : ''}]\n${c.content}`).join('\n\n')}`
    : '\n\nNo specific regulatory sources were retrieved for this combination — generate the policy from general best-practice knowledge and note this in a footer disclaimer.';

  return `Generate a complete, ready-to-adopt ${POLICY_TYPE_LABELS[type]} for a ${POLICY_SECTOR_LABELS[sector]} organization in Nigeria.

Organization name: ${orgContext.organizationName}
${orgContext.additionalContext ? `Additional context: ${orgContext.additionalContext}` : ''}

Sector-specific guidance: ${SECTOR_GUIDANCE[sector]}

Structure the policy as a professional markdown document with:
1. Purpose and Scope
2. Policy Statement(s) — the core rules
3. Roles and Responsibilities
4. Compliance and Enforcement
5. Review Cycle

Where a rule derives from a specific regulation or standard (NDPA, GAID, ISO 27001, CIS Controls), cite it inline using "[Document Title §Section]" format. Do not fabricate section numbers — only cite sections that appear in the retrieved sources below.${groundingBlock}`;
}

function toChatSource(c: Awaited<ReturnType<KnowledgeSearchService['search']>>[number]): ChatSource {
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

export async function generatePolicy(
  type: PolicyType,
  sector: PolicySector,
  orgContext: PolicyOrgContext,
  organizationId: string,
  userId: string,
): Promise<GeneratedPolicy> {
  const client = getOpenAIClient();
  const startTime = Date.now();

  const queryText = `${POLICY_TYPE_LABELS[type]} ${POLICY_SECTOR_LABELS[sector]} compliance requirements`;

  let retrievedChunks: Awaited<ReturnType<KnowledgeSearchService['search']>> = [];
  try {
    // Deliberately unscoped — see file header comment.
    retrievedChunks = await getKnowledgeSearch().search(queryText, { organizationId });
  } catch (err: any) {
    logger.error('Policy generation: knowledge retrieval failed, continuing ungrounded', { errorMessage: err?.message });
  }

  const systemPrompt = `You are CyberGuard AI's policy generation engine, producing professional, adoptable security policy documents for African enterprises, grounded in Nigerian and international regulatory/standards guidance where retrieved. Never present a superseded regulation (e.g. NDPR 2019) as current law — always defer to NDPA 2023 / GAID 2025 for Nigerian data protection requirements. Output only the policy document in markdown, no preamble or meta-commentary.`;

  const generationPromise = client.chat.completions.create({
    model: config.openai.deploymentName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildPolicyPrompt(type, sector, orgContext, retrievedChunks) },
    ],
    max_completion_tokens: POLICY_MAX_COMPLETION_TOKENS,
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error('Policy generation timed out'), { code: 'GENERATION_TIMEOUT' })), GENERATION_TIMEOUT_MS),
  );

  const completion = await Promise.race([generationPromise, timeoutPromise]);

  const choice = completion.choices[0];
  const content = choice?.message?.content ?? '';
  if (!content.trim()) {
    console.error('Policy generation returned empty content', JSON.stringify({
      finishReason: choice?.finish_reason,
      usage: completion.usage,
      type, sector,
    }));
    const serviceErr = new Error('Policy generation returned empty content') as any;
    serviceErr.statusCode = 502;
    serviceErr.code = 'AI_EMPTY_RESPONSE';
    throw serviceErr;
  }

  const latencyMs = Date.now() - startTime;
  logger.info('Policy generated', { type, sector, latencyMs, sourcesRetrieved: retrievedChunks.length });

  const policy: GeneratedPolicy = {
    id: uuidv4(),
    organizationId,
    userId,
    type,
    sector,
    title: `${POLICY_TYPE_LABELS[type]} — ${orgContext.organizationName}`,
    content,
    sources: retrievedChunks.map(toChatSource),
    orgContext,
    createdAt: new Date().toISOString(),
  };

  return policy;
}
