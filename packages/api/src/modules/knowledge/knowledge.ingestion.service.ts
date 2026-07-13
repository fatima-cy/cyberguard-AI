/**
 * packages/api/src/modules/knowledge/knowledge.ingestion.service.ts
 * (corrected: @cyberguard/shared import, pdf-parse require-style import,
 *  deleteDocuments called with the key-only overload instead of full documents)
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { SearchClient } from '@azure/search-documents';
import { AzureOpenAI } from 'openai';
import { PDFParse } from 'pdf-parse'; // pdf-parse v2.x uses a class-based API:
                                        // new PDFParse({ data: buffer }), then
                                        // await parser.getText(), then
                                        // await parser.destroy(). Confirmed against
                                        // the actually-installed v2.4.5 — the old v1
                                        // callable-function API (pdf(buffer)) no
                                        // longer exists in this version.
import { KnowledgeRepository } from '../../repositories/knowledge.repository';
import type { KnowledgeChunkIndexFields, KnowledgeDocument } from '@cyberguard/shared';
import { PRIORITY_RANK } from '../../scripts/knowledge.registry.seed';

const CHUNK_TOKEN_SIZE = 512;
const CHUNK_TOKEN_OVERLAP = 50;
const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 3072;

const LICENSE_GATED_DOCUMENT_IDS = new Set<string>(['iso-27001-2022']);

export interface IngestOptions {
  confirmedLicensed?: boolean;
}

export class KnowledgeIngestionService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly searchClient: SearchClient<KnowledgeChunkIndexFields>,
    private readonly blobService: BlobServiceClient,
    private readonly openai: AzureOpenAI,
  ) {}

  async ingest(documentId: string, blobName: string, options: IngestOptions = {}): Promise<{ chunkCount: number }> {
    const doc = await this.repository.getById(documentId);
    if (!doc) {
      throw new Error(`[knowledge.ingestion] no registry entry for documentId "${documentId}" — seed the registry before ingesting.`);
    }

    this.assertIngestible(doc, options);

    const buffer = await this.downloadBlob(blobName);
    const text = await this.extractText(buffer);
    const chunks = this.chunkText(text);

    console.log(
      `[knowledge.ingestion] "${doc.id}": ${chunks.length} chunks to embed at 5/batch — ` +
      `estimated ~${Math.ceil((chunks.length / 5) * 20 / 60)} min given the confirmed 10K TPM quota`,
    );

    const embeddings = await this.embedChunks(chunks);

    const indexDocs: KnowledgeChunkIndexFields[] = chunks.map((chunkText, i) => ({
      // Azure AI Search document keys only allow letters, digits, underscore,
      // dash, and equals sign — periods (and other characters) are rejected.
      // Registry ids like "nist-csf-2.0" and "cis-controls-8.1" contain periods,
      // so the KEY must be sanitized even though the real documentId (used for
      // filtering, not as a key) keeps the original, unsanitized registry id.
      id: `${this.sanitizeKey(doc.id)}__chunk-${String(i).padStart(4, '0')}`,
      documentId: doc.id,
      content: chunkText,
      embedding: embeddings[i],
      documentTitle: doc.documentTitle,
      source: blobName,
      section: this.inferSection(chunkText),
      chunkIndex: i,
      version: doc.version,
      status: doc.status,
      priority: doc.priority,
      priorityRank: PRIORITY_RANK[doc.priority],
      jurisdiction: doc.jurisdictions,
      publicationDate: doc.publicationDate,
      effectiveDate: doc.effectiveDate,
      supersedes: doc.supersedes,
      supersededBy: doc.supersededBy,
      sourceUrl: doc.sourceUrl,
      publisher: doc.trustProfile.publisher,
      authorityLevel: doc.trustProfile.authorityLevel,
      verificationStatus: doc.trustProfile.verificationStatus,
      trustScore: doc.trustProfile.trustScore,
      tags: doc.tags,
      category: doc.category,
      language: doc.language,
      organizationId: doc.organizationId,
      lastIngestedAt: new Date().toISOString(),
    }));

    await this.deleteExistingChunks(doc.id);

    const BATCH_SIZE = 1000;
    for (let i = 0; i < indexDocs.length; i += BATCH_SIZE) {
      const batch = indexDocs.slice(i, i + BATCH_SIZE);
      const result = await this.searchClient.mergeOrUploadDocuments(batch);
      const failed = result.results.filter((r) => !r.succeeded);
      if (failed.length > 0) {
        throw new Error(
          `[knowledge.ingestion] ${failed.length}/${batch.length} chunks failed to index for ${doc.id}: ` +
          failed.map((f) => `${f.key}: ${f.errorMessage}`).join('; '),
        );
      }
    }

    await this.repository.recordIngestion(doc.id, indexDocs.length);

    return { chunkCount: indexDocs.length };
  }

  private assertIngestible(doc: KnowledgeDocument, options: IngestOptions): void {
    if (doc.status === 'pending_review') {
      throw new Error(
        `[knowledge.ingestion] refusing to ingest "${doc.id}" — status is 'pending_review'. ` +
        `Complete the governance validation checklist (section B) and promote to 'current' first.`,
      );
    }
    if (doc.status === 'deprecated') {
      throw new Error(`[knowledge.ingestion] refusing to ingest "${doc.id}" — status is 'deprecated'.`);
    }
    if (LICENSE_GATED_DOCUMENT_IDS.has(doc.id) && !options.confirmedLicensed) {
      throw new Error(
        `[knowledge.ingestion] refusing to ingest "${doc.id}" — this document requires a confirmed content ` +
        `license. Pass { confirmedLicensed: true } only after CloudSecure holds a verified license.`,
      );
    }
  }

  /** Azure AI Search document keys allow only letters, digits, underscore, dash,
   *  and equals sign. Registry ids like "nist-csf-2.0" or "cis-controls-8.1"
   *  contain periods, which are rejected outright (not silently accepted) — so
   *  every character outside that allowed set gets replaced with a dash. This
   *  only affects the search-index KEY; the real, unsanitized registry id is
   *  preserved everywhere else (documentId field, Cosmos records, logs). */
  private sanitizeKey(id: string): string {
    return id.replace(/[^a-zA-Z0-9_\-=]/g, '-');
  }

  private async downloadBlob(blobName: string): Promise<Buffer> {
    const container = this.blobService.getContainerClient('knowledge-sources');
    const blob = container.getBlobClient(blobName);
    return blob.downloadToBuffer();
  }

  /** pdf-parse v2's PDFParse class requires explicit destroy() to free memory —
   *  wrapped in try/finally so a parse failure doesn't leak the parser instance. */
  private async extractText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  /** Fixed: uses the (keyName, keyValues) overload of deleteDocuments instead of
   *  constructing partial documents that don't satisfy KnowledgeChunkIndexFields. */
  private async deleteExistingChunks(documentId: string): Promise<void> {
    const existing = await this.searchClient.search('*', {
      filter: `documentId eq '${documentId}'`,
      select: ['id'],
      top: 1000,
    });
    const idsToDelete: string[] = [];
    for await (const result of existing.results) {
      idsToDelete.push(result.document.id);
    }
    if (idsToDelete.length > 0) {
      await this.searchClient.deleteDocuments('id', idsToDelete);
    }
  }

  private chunkText(text: string): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + CHUNK_TOKEN_SIZE, words.length);
      chunks.push(words.slice(start, end).join(' '));
      if (end === words.length) break;
      start = end - CHUNK_TOKEN_OVERLAP;
    }
    return chunks;
  }

  private inferSection(chunkText: string): string {
    const firstLine = chunkText.split('\n')[0].trim();
    const sectionMatch = firstLine.match(/^(Article|Section|Chapter|Part|A\d{2}:)\s*[\w.]+/i);
    return sectionMatch ? sectionMatch[0] : firstLine.slice(0, 60) || 'General';
  }

  private async embedChunks(chunks: string[]): Promise<number[][]> {
    // BATCH_SIZE reduced from 96 to 5 after confirming this deployment's actual
    // provisioned throughput: 10,000 TPM (GlobalStandard, capacity=10), verified
    // via `az cognitiveservices account deployment list`. At ~512-700 tokens per
    // chunk, a 96-chunk batch is 40-50K tokens in one request — 4-5x over quota
    // in a single call, which is why waiting/retrying never helped: the same
    // oversized request just failed again every time. 5 chunks/batch keeps each
    // request comfortably under budget (~3,500 tokens), and the pacing delay
    // between batches keeps the trailing-60s total under 10K as well.
    const BATCH_SIZE = 5;
    const PACING_DELAY_MS = 20000; // ~2 batches/minute ≈ 7K tokens/min, safely under the 10K TPM quota
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await this.embedBatchWithRetry(batch);
      embeddings.push(...batchEmbeddings);

      if (i + BATCH_SIZE < chunks.length) {
        await this.sleep(PACING_DELAY_MS);
      }
    }
    return embeddings;
  }

  /** Retries on 429 (rate limit) with exponential backoff, honoring the API's
   *  suggested retry delay when present. Azure OpenAI's S0 tier default quota is
   *  low enough that a single large document's embedding batches can exhaust it —
   *  this is expected and recoverable, not a bug, so retrying is the correct
   *  response rather than failing the whole ingestion run. */
  private async embedBatchWithRetry(
    batch: string[],
    attempt: number = 1,
    maxAttempts: number = 6,
  ): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      });
      return response.data.map((d) => d.embedding);
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || err?.code === 'RateLimitReached';
      if (!isRateLimit || attempt >= maxAttempts) throw err;

      // Prefer the server's suggested delay ("retry after 60 seconds") if present
      // in the error message; otherwise fall back to exponential backoff.
      const suggestedMatch = /retry after (\d+) seconds?/i.exec(err?.message ?? '');
      const delayMs = suggestedMatch
        ? parseInt(suggestedMatch[1], 10) * 1000 + 1000 // +1s buffer past the suggestion
        : Math.min(2 ** attempt * 1000, 60000);

      console.warn(
        `[knowledge.ingestion] rate limited (attempt ${attempt}/${maxAttempts}), ` +
        `waiting ${Math.round(delayMs / 1000)}s before retry...`,
      );
      await this.sleep(delayMs);
      return this.embedBatchWithRetry(batch, attempt + 1, maxAttempts);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
