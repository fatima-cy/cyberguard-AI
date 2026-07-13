/**
 * packages/api/src/config/blob.ts
 *
 * Azure Blob Storage client, matching the managed-identity/fallback pattern
 * already established in openai.client.ts and db.ts. Singleton, initialised
 * once on first import.
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { credential } from './identity';
import { config } from './env';
import { logger } from '../core/observability/logger';

let _client: BlobServiceClient | null = null;

export function getBlobServiceClient(): BlobServiceClient {
  if (_client) return _client;

  const endpoint = config.azure.endpoints.blob;
  const connectionString = config.azure.fallbacks.blobConnectionString;

  if (endpoint) {
    _client = new BlobServiceClient(endpoint, credential);
    logger.info('Blob Storage client initialised', { strategy: 'ManagedIdentity', endpoint });
  } else if (connectionString) {
    _client = BlobServiceClient.fromConnectionString(connectionString);
    logger.warn('Blob Storage client initialised with connection string fallback', {
      strategy: 'ConnectionString',
    });
  } else {
    throw new Error(
      'Blob Storage not configured. Set BLOB_ENDPOINT (managed identity) ' +
      'or BLOB_CONNECTION_STRING (development fallback) in your environment.',
    );
  }

  return _client;
}
