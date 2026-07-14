/**
 * packages/shared/src/types/phishing.types.ts
 *
 * Sprint 3.2 — AI Phishing Analyzer types.
 * @see Sprint 3 Plan, Priority 2
 */

import type { ChatSource } from './chat.types';

export type PhishingRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IndicatorType = 'URL' | 'DOMAIN' | 'SUBJECT' | 'SENDER' | 'ATTACHMENT';
export type IndicatorSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PhishingIndicator {
  type: IndicatorType;
  value: string;
  description: string;
  severity: IndicatorSeverity;
}

export interface PhishingAnalysisInput {
  emailContent?: string;
  url?: string;
  senderDomain?: string;
  subject?: string;
  attachmentNames?: string[];
}

export interface PhishingAnalysis {
  id: string;               // = analysisId
  organizationId: string;
  userId: string;
  riskScore: number;        // 0-100
  riskLevel: PhishingRiskLevel;
  verdict: string;
  executiveSummary: string;
  technicalSummary: string;
  indicators: PhishingIndicator[];
  recommendedActions: string[];
  sources: ChatSource[];    // reuses the Sprint 3.1 citation type — same RAG grounding pattern
  input: PhishingAnalysisInput; // stored for history display, not re-sent to the model on read
  createdAt: string;        // ISO 8601
}
