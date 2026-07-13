/**
 * packages/api/src/config/search.ts
 *
 * Azure AI Search client factory, matching the managed-identity/fallback pattern
 * already established in openai.client.ts, db.ts, and blob.ts. Generic over the
 * index's document shape — call with the index name (defaults to the knowledge
 * index, since that's the only consumer as of Sprint 3.1).
 */

import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { credential } from './identity';
import { config } from './env';
import { logger } from '../core/observability/logger';

const _clients = new Map<string, SearchClient<any>>();

export function getSearchClient<T extends object>(
  indexName: string = 'cyberguard-knowledge',
): SearchClient<T> {
  const cached = _clients.get(indexName);
  if (cached) return cached as SearchClient<T>;

  const endpoint = config.azure.endpoints.aiSearch;
  const apiKey = config.azure.fallbacks.aiSearchApiKey;

  if (!endpoint) {
    throw new Error(
      'Azure AI Search not configured. Set AISEARCH_ENDPOINT in your environment ' +
      '(see .env — should already be present per Sprint 0 notes).',
    );
  }

  let client: SearchClient<T>;
  if (apiKey) {
    // AI Search commonly uses key-based auth even in managed-identity-first setups,
    // since RBAC-based data-plane access for AI Search is a more recent capability
    // than for Cosmos/OpenAI — falls back to key auth if AISEARCH_API_KEY is set,
    // otherwise attempts managed identity via the same `credential` used elsewhere.
    client = new SearchClient<T>(endpoint, indexName, new AzureKeyCredential(apiKey));
    logger.warn('AI Search client initialised with API key', { strategy: 'ApiKey', indexName });
  } else {
    client = new SearchClient<T>(endpoint, indexName, credential as any);
    logger.info('AI Search client initialised', { strategy: 'ManagedIdentity', indexName });
  }

  _clients.set(indexName, client);
  return client;
}
