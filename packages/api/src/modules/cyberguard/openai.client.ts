/**
 * CyberGuard AI — Azure OpenAI Client
 *
 * Initialises the Azure OpenAI client using Managed Identity (production)
 * or API key fallback (local development without managed identity).
 *
 * The client is a singleton — initialised once on first import.
 *
 * @see Blueprint §6.1 — CyberGuard AI Chat Module
 * @see Sprint 1.5
 */

import { AzureOpenAI } from 'openai';
import { getBearerTokenProvider } from '@azure/identity';
import { credential } from '../../config/identity';
import { config } from '../../config/env';
import { logger } from '../../core/observability/logger';

// ─── Singleton client ─────────────────────────────────────────────────────────

let _client: AzureOpenAI | null = null;

export function getOpenAIClient(): AzureOpenAI {
  if (_client) return _client;

  const endpoint = config.azure.endpoints.openai;
  const apiKey = config.azure.fallbacks.openaiApiKey;

  if (endpoint) {
    // Production / Staging: Managed Identity via token provider
    const scope = 'https://cognitiveservices.azure.com/.default';
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);

    _client = new AzureOpenAI({
      endpoint,
      azureADTokenProvider,
      apiVersion: '2024-10-21',
    });

    logger.info('Azure OpenAI client initialised', {
      strategy: 'ManagedIdentity',
      endpoint,
      deployment: config.openai.deploymentName,
    });
  } else if (apiKey) {
    // Local development fallback: API key
    _client = new AzureOpenAI({
      apiKey,
      apiVersion: '2024-10-21',
    });

    logger.warn('Azure OpenAI client initialised with API key fallback', {
      strategy: 'ApiKey',
    });
  } else {
    throw new Error(
      'Azure OpenAI not configured. Set OPENAI_ENDPOINT (managed identity) ' +
      'or OPENAI_API_KEY (development fallback) in your environment.',
    );
  }

  return _client;
}
