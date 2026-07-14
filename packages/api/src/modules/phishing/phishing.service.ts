/**
 * packages/api/src/modules/phishing/phishing.service.ts
 *
 * Sprint 3.2 — AI Phishing Analyzer.
 * Reuses the Sprint 3.1 KnowledgeSearchService for RAG grounding (OWASP,
 * CISA guidance) and getOpenAIClient() for structured JSON-mode analysis —
 * no new Azure clients needed, matching the "no architectural redesign"
 * CTO directive.
 */

import { v4 as uuidv4 } from 'uuid';
import { getOpenAIClient } from '../cyberguard/openai.client';
import { getSearchClient } from '../../config/search';
import { KnowledgeSearchService } from '../knowledge/knowledge.search.service';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';
import type {
  PhishingAnalysisInput,
  PhishingAnalysis,
  PhishingIndicator,
  PhishingRiskLevel,
  ChatSource,
  KnowledgeChunkIndexFields,
} from '@cyberguard/shared';

let _knowledgeSearch: KnowledgeSearchService | null = null;
function getKnowledgeSearch(): KnowledgeSearchService {
  if (_knowledgeSearch) return _knowledgeSearch;
  _knowledgeSearch = new KnowledgeSearchService(getSearchClient<KnowledgeChunkIndexFields>(), getOpenAIClient());
  return _knowledgeSearch;
}

const ANALYSIS_SYSTEM_PROMPT = `You are CyberGuard AI's phishing analysis engine. Analyze the provided email/URL/metadata for phishing indicators.

Ground your analysis in the retrieved OWASP and CISA guidance provided below where relevant — cite specific indicator types and severities consistent with that guidance. Only reference a retrieved source if it genuinely supports a specific point; do not force an awkward citation to a source that doesn't actually fit just because it was retrieved.

Respond ONLY with valid JSON matching this exact shape, no other text:
{
  "riskScore": <number 0-100>,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "verdict": "<one sentence verdict>",
  "executiveSummary": "<2-3 sentences, non-technical, for a business owner>",
  "technicalSummary": "<2-4 sentences, technical detail for a security-literate reader>",
  "indicators": [
    { "type": "URL" | "DOMAIN" | "SUBJECT" | "SENDER" | "ATTACHMENT", "value": "<the specific value>", "description": "<why this is suspicious>", "severity": "LOW" | "MEDIUM" | "HIGH" }
  ],
  "recommendedActions": ["<action 1>", "<action 2>", ...]
}

Risk score bands: 0-24 LOW, 25-49 MEDIUM, 50-79 HIGH, 80-100 CRITICAL.
If the input shows no phishing indicators, return a low riskScore and say so plainly — do not manufacture indicators to justify a higher score.`;

function buildAnalysisPrompt(input: PhishingAnalysisInput, chunks: Awaited<ReturnType<KnowledgeSearchService['search']>>): string {
  const inputBlock = [
    input.subject && `Subject: ${input.subject}`,
    input.senderDomain && `Sender domain: ${input.senderDomain}`,
    input.url && `URL: ${input.url}`,
    input.attachmentNames?.length && `Attachments: ${input.attachmentNames.join(', ')}`,
    input.emailContent && `Email content:\n${input.emailContent}`,
  ].filter(Boolean).join('\n');

  const groundingBlock = chunks.length > 0
    ? `\n\nRelevant guidance:\n${chunks.map((c, i) => `[${i + 1}: ${c.documentTitle}${c.section ? ` §${c.section}` : ''}]\n${c.content}`).join('\n\n')}`
    : '';

  return `Analyze the following:\n\n${inputBlock}${groundingBlock}`;
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

/** Basic shape/range validation on the model's JSON output — cheap insurance
 *  against a malformed or out-of-spec response before it's persisted. */
function validateAnalysisShape(parsed: any): void {
  if (typeof parsed.riskScore !== 'number' || parsed.riskScore < 0 || parsed.riskScore > 100) {
    throw new Error('Model returned invalid riskScore');
  }
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(parsed.riskLevel)) {
    throw new Error('Model returned invalid riskLevel');
  }
  if (!Array.isArray(parsed.indicators) || !Array.isArray(parsed.recommendedActions)) {
    throw new Error('Model returned malformed indicators/recommendedActions');
  }
}

export async function analyzePhishing(
  input: PhishingAnalysisInput,
  organizationId: string,
  userId: string,
): Promise<PhishingAnalysis> {
  const client = getOpenAIClient();
  const startTime = Date.now();

  const queryText = [input.subject, input.senderDomain, input.url, input.emailContent]
    .filter(Boolean).join(' ').slice(0, 2000); // cap query length for embedding

  let retrievedChunks: Awaited<ReturnType<KnowledgeSearchService['search']>> = [];
  try {
    // Category-scoped first: phishing analysis needs OWASP/CISA technical
    // guidance, not privacy regulation — without this filter, GAID's higher
    // authorityLevel tier (regulatory) systematically outranks OWASP/CISA
    // (standards_body/government_advisory) in the precedence order regardless
    // of actual topical relevance. Confirmed via live testing: an obvious
    // phishing sample returned 5/5 GAID sources and zero OWASP/CISA sources
    // before this fix. See knowledge.search.service.ts's SearchOptions.categories
    // doc comment for the full explanation.
    retrievedChunks = await getKnowledgeSearch().search(
      queryText || 'phishing indicators email security',
      { organizationId, categories: ['appsec', 'cybersecurity'] },
    );
    // Fallback: if category-scoped search finds nothing (e.g. a query that
    // genuinely only matches privacy-regulation content), retry unscoped
    // rather than returning an ungrounded analysis unnecessarily.
    if (retrievedChunks.length === 0) {
      retrievedChunks = await getKnowledgeSearch().search(
        queryText || 'phishing indicators email security',
        { organizationId },
      );
    }
  } catch (err: any) {
    logger.error('Phishing analysis: knowledge retrieval failed, continuing ungrounded', { errorMessage: err?.message });
  }

  const messages = [
    { role: 'system' as const, content: ANALYSIS_SYSTEM_PROMPT },
    { role: 'user' as const, content: buildAnalysisPrompt(input, retrievedChunks) },
  ];

  const completion = await client.chat.completions.create({
    model: config.openai.deploymentName,
    messages,
    max_completion_tokens: config.openai.maxTokens,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
    validateAnalysisShape(parsed);
  } catch (err: any) {
    logger.error('Phishing analysis: model returned invalid JSON', { errorMessage: err?.message, raw: raw.slice(0, 500) });
    const serviceErr = new Error('AI analysis returned an invalid response') as any;
    serviceErr.statusCode = 502;
    serviceErr.code = 'AI_INVALID_RESPONSE';
    throw serviceErr;
  }

  const latencyMs = Date.now() - startTime;
  logger.info('Phishing analysis completed', {
    riskLevel: parsed.riskLevel,
    riskScore: parsed.riskScore,
    latencyMs,
    sourcesRetrieved: retrievedChunks.length,
  });

  const analysis: PhishingAnalysis = {
    id: uuidv4(),
    organizationId,
    userId,
    riskScore: parsed.riskScore,
    riskLevel: parsed.riskLevel as PhishingRiskLevel,
    verdict: parsed.verdict ?? '',
    executiveSummary: parsed.executiveSummary ?? '',
    technicalSummary: parsed.technicalSummary ?? '',
    indicators: (parsed.indicators ?? []) as PhishingIndicator[],
    recommendedActions: (parsed.recommendedActions ?? []) as string[],
    sources: retrievedChunks.map(toChatSource),
    input,
    createdAt: new Date().toISOString(),
  };

  return analysis;
}
