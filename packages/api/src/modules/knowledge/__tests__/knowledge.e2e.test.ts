/**
 * packages/api/src/modules/knowledge/__tests__/knowledge.e2e.test.ts
 * (corrected: converted from vitest to Jest — this project uses Jest, per
 *  package.json's "test:unit"/"test:integration" scripts — and fixed
 *  TypeScript "used before assigned" errors with definite-assignment typing.)
 *
 * REQUIRES a live environment: real Cosmos, real AI Search index with ingested
 * content, real Azure OpenAI. Gated behind RUN_KNOWLEDGE_E2E=true so it doesn't
 * run against live resources during a normal `npm run test:unit`. Wire into
 * test:integration once ready — this belongs alongside the existing
 * tests/integration/tenant-isolation-style suites, not the unit suite.
 */

import { KnowledgeSearchService } from '../knowledge.search.service';
import { KnowledgeRepository } from '../../../repositories/knowledge.repository';
// ...import real client factories here, matching whatever tests/integration
// already uses to construct Cosmos/AI Search/OpenAI clients for other Sprint 1/2
// integration tests — I don't have that bootstrap code to reference directly.

const RUN_LIVE = process.env.RUN_KNOWLEDGE_E2E === 'true';
const describeIfLive = RUN_LIVE ? describe : describe.skip;

describeIfLive('Knowledge RAG — end-to-end validation', () => {
  let searchService!: KnowledgeSearchService;
  let repository!: KnowledgeRepository;

  beforeAll(async () => {
    // Wire real clients here, matching existing test bootstrap conventions.
    // Assigning here (not at declaration) is exactly why TypeScript flagged
    // "used before assigned" in the original version — the fix is either this
    // beforeAll pattern with `!` definite-assignment assertions on the `let`
    // declarations above, or moving client construction into a factory function
    // called at the top of each test. Using `!` here since that matches how
    // Jest test suites conventionally handle beforeAll-initialized fixtures.
  });

  describe('Grounded responses', () => {
    it('returns non-empty, relevant chunks for a clearly-covered query', async () => {
      const results = await searchService.search(
        'What is the breach notification deadline under Nigerian data protection law?',
        { organizationId: null },
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].documentTitle).toMatch(/NDPA|GAID/);
    });

    it('produces an ungrounded indicator for an out-of-corpus query', async () => {
      const results = await searchService.search(
        'What is the capital of France?',
        { organizationId: null },
      );
      const allLowConfidence = results.every((r) => r.confidenceLabel === 'Low');
      expect(results.length === 0 || allLowConfidence).toBe(true);
    });
  });

  describe('Source citations', () => {
    it('every returned chunk carries a complete citation payload', async () => {
      const results = await searchService.search('data protection officer requirements', {
        organizationId: null,
      });
      for (const chunk of results) {
        expect(chunk.documentTitle).toBeTruthy();
        expect(chunk.sourceUrl).toMatch(/^https?:\/\//);
        expect(chunk.version).toBeTruthy();
        expect(['High', 'Medium', 'Low']).toContain(chunk.confidenceLabel);
      }
    });
  });

  describe('Current vs. historical retrieval behaviour', () => {
    it('default search excludes historical NDPR content', async () => {
      const results = await searchService.search('data protection regulation Nigeria', {
        organizationId: null,
        includeHistorical: false,
      });
      expect(results.every((r) => r.status !== 'historical')).toBe(true);
    });

    it('explicit historical query surfaces NDPR with a supersededBy notice', async () => {
      const results = await searchService.search(
        'how did NDPR 2019 handle breach notification before NDPA?',
        { organizationId: null, includeHistorical: true },
      );
      const historicalHit = results.find((r) => r.status === 'historical');
      expect(historicalHit).toBeDefined();
      expect(historicalHit!.supersededBy.length).toBeGreaterThan(0);
    });

    it('a current document ranks first by default', async () => {
      const results = await searchService.search('Nigeria data protection breach notification', {
        organizationId: null,
        includeHistorical: false,
      });
      if (results.length > 0) {
        expect(results[0].status).toBe('current');
      }
    });
  });

  describe('Semantic search quality', () => {
    it('ranks a directly-relevant chunk above a tangentially-related one', async () => {
      const results = await searchService.search('OWASP broken access control', {
        organizationId: null,
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].documentTitle).toMatch(/OWASP/);
    });
  });

  describe('Retrieval latency', () => {
    it('completes within a generous smoke-test bound', async () => {
      const timings: number[] = [];
      const queries = [
        'data protection officer',
        'incident response plan',
        'access control failure',
        'security misconfiguration',
        'phishing indicators',
      ];
      for (const q of queries) {
        const start = Date.now();
        await searchService.search(q, { organizationId: null });
        timings.push(Date.now() - start);
      }
      timings.sort((a, b) => a - b);
      const p95 = timings[Math.floor(timings.length * 0.95)] ?? timings[timings.length - 1];
      // NOTE: 5 samples is a smoke check, not a real p95 measurement — see
      // sprint4-backlog.md, "Proper latency load testing."
      expect(p95).toBeLessThan(2000);
    }, 30000); // generous Jest timeout override for this test — live network calls
  });

  describe('Governance filters', () => {
    it('never returns iso-27001-2022 content while it remains unlicensed', async () => {
      const results = await searchService.search('information security management system', {
        organizationId: null,
      });
      expect(results.every((r) => !r.documentTitle.includes('ISO/IEC 27001'))).toBe(true);
      // Deliberate tripwire: should pass trivially since iso-27001-2022 is never
      // ingested in Sprint 3.1 — fails loudly if someone ingests it later without
      // updating this test alongside the licensing decision.
    });
  });
});
