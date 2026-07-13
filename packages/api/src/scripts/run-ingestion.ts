/**
 * packages/api/src/scripts/run-ingestion.ts
 * (corrected: @cyberguard/shared import; run via ts-node, not tsx — this project
 *  uses ts-node, see package.json's existing "seed" and "dev" scripts)
 *
 * Usage:
 *   npx ts-node src/scripts/run-ingestion.ts --documentId ndpa-2023 --blobName ndpa-2023.pdf
 *   npx ts-node src/scripts/run-ingestion.ts --documentId iso-27001-2022 --blobName iso-27001-2022.pdf --confirmedLicensed
 */

import { container } from '../config/db';
import { getOpenAIClient } from '../modules/cyberguard/openai.client';
import { getBlobServiceClient } from '../config/blob';
import { getSearchClient } from '../config/search';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import { KnowledgeIngestionService } from '../modules/knowledge/knowledge.ingestion.service';
import type { KnowledgeChunkIndexFields } from '@cyberguard/shared';

function parseArgs(): { documentId: string; blobName: string; confirmedLicensed: boolean } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const documentId = get('--documentId');
  const blobName = get('--blobName');
  const confirmedLicensed = args.includes('--confirmedLicensed');

  if (!documentId || !blobName) {
    console.error('Usage: run-ingestion.ts --documentId <id> --blobName <name.pdf> [--confirmedLicensed]');
    process.exit(1);
  }
  return { documentId, blobName, confirmedLicensed };
}

async function main() {
  const { documentId, blobName, confirmedLicensed } = parseArgs();

  // Every client below is reused from the app's existing config layer —
  // same managed-identity/fallback logic the rest of CyberGuard AI already
  // uses (config/db.ts, config/identity.ts, openai.client.ts). No separate
  // env/dotenv handling needed here; config/env.ts already loads .env once,
  // on first import, from anywhere in the dependency graph.
  const repository = new KnowledgeRepository(container('knowledge_documents'));
  const openai = getOpenAIClient();
  const blobService = getBlobServiceClient();
  const searchClient = getSearchClient<KnowledgeChunkIndexFields>();

  const ingestionService = new KnowledgeIngestionService(repository, searchClient, blobService, openai);

  console.log(`[run-ingestion] starting: documentId=${documentId} blobName=${blobName} confirmedLicensed=${confirmedLicensed}`);
  const start = Date.now();

  try {
    const result = await ingestionService.ingest(documentId, blobName, { confirmedLicensed });
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[run-ingestion] SUCCESS: ${result.chunkCount} chunks indexed for "${documentId}" in ${seconds}s`);
    process.exit(0);
  } catch (err: any) {
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`[run-ingestion] FAILED for "${documentId}" after ${seconds}s:`);
    console.error('  message:', err?.message ?? '(no message)');
    console.error('  name:', err?.name ?? '(no name)');
    console.error('  code:', err?.code ?? '(no code)');
    console.error('  statusCode:', err?.statusCode ?? '(no statusCode)');
    console.error('  full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    if (err?.stack) console.error('  stack:', err.stack);
    process.exit(1);
  }
}

main();
