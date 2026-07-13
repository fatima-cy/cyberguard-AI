/**
 * packages/api/src/scripts/knowledge.registry.seed.ts
 * (corrected: import from '@cyberguard/shared')
 *
 * IDEMPOTENCY: uses upsert with deterministic ids — safe to re-run.
 */

import { Container } from '@azure/cosmos';
import { container } from '../config/db';
import type { KnowledgeDocument, DocumentPriority } from '@cyberguard/shared';

export const PRIORITY_RANK: Record<DocumentPriority, number> = {
  primary: 100,
  secondary: 50,
  tertiary: 10,
};

function computeNextReviewDate(cadence: 'quarterly' | 'annual' | 'rolling' | 'none', anchor: string): string | null {
  if (cadence === 'none') return null;
  const anchorDate = new Date(anchor);
  const next = new Date(anchorDate);
  if (cadence === 'quarterly') next.setMonth(next.getMonth() + 3);
  if (cadence === 'annual') next.setFullYear(next.getFullYear() + 1);
  if (cadence === 'rolling') next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

const REGISTRY_ENTRIES: Omit<KnowledgeDocument, 'chunkCount' | 'lastIngestedAt'>[] = [
  {
    id: 'ndpa-2023',
    documentTitle: 'Nigeria Data Protection Act (NDPA) 2023',
    version: '2023',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['Nigeria'],
    publicationDate: '2023-06-13',
    effectiveDate: '2023-06-13',
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://ndpc.gov.ng/download/nigeria-data-protection-act-2023',
    trustProfile: {
      publisher: 'Nigeria Data Protection Commission (NDPC)',
      authorityLevel: 'regulatory',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 100,
    },
    tags: ['data-protection', 'privacy', 'breach-notification', 'consent', 'dpo'],
    category: ['regulation', 'privacy'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    id: 'gaid-2025',
    documentTitle: 'General Application & Implementation Directive (GAID) 2025',
    version: '2025',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['Nigeria'],
    publicationDate: '2025-03-20',
    effectiveDate: '2025-09-19',
    deprecationDate: null,
    supersedes: ['ndpr-2019'],
    supersededBy: [],
    sourceUrl: 'https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf',
    trustProfile: {
      publisher: 'Nigeria Data Protection Commission (NDPC)',
      authorityLevel: 'regulatory',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 100,
    },
    tags: ['data-protection', 'privacy', 'implementation-directive'],
    category: ['regulation', 'privacy'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    id: 'ndpr-2019',
    documentTitle: 'Nigeria Data Protection Regulation (NDPR) 2019',
    version: '2019',
    status: 'historical',
    priority: 'secondary',
    jurisdictions: ['Nigeria'],
    publicationDate: '2019-01-25',
    effectiveDate: '2019-01-25',
    deprecationDate: '2025-09-19',
    supersedes: [],
    supersededBy: ['gaid-2025'],
    sourceUrl: 'https://nitda.gov.ng/wp-content/uploads/2020/11/NigeriaDataProtectionRegulation11.pdf',
    trustProfile: {
      publisher: 'National Information Technology Development Agency (NITDA)',
      authorityLevel: 'regulatory',
      verificationStatus: 'deprecated',
      reviewCadence: 'none',
      nextReviewDate: null,
      trustScore: 40,
    },
    tags: ['data-protection', 'privacy', 'historical'],
    category: ['regulation', 'privacy'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    id: 'nist-csf-2.0',
    documentTitle: 'NIST Cybersecurity Framework (CSF) 2.0',
    version: '2.0',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['Global'],
    publicationDate: '2024-02-26',
    effectiveDate: '2024-02-26',
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf',
    trustProfile: {
      publisher: 'National Institute of Standards and Technology (NIST)',
      authorityLevel: 'standards_body',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 98,
    },
    tags: ['framework', 'risk-management', 'governance'],
    category: ['framework', 'cybersecurity'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    id: 'iso-27001-2022',
    documentTitle: 'ISO/IEC 27001:2022 (Information Security Management)',
    version: '2022',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['Global'],
    publicationDate: '2022-10-25',
    effectiveDate: '2022-10-25',
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://www.iso.org/standard/27001',
    trustProfile: {
      publisher: 'International Organization for Standardization (ISO)',
      authorityLevel: 'standards_body',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 98,
    },
    tags: ['isms', 'controls', 'certification'],
    category: ['framework', 'cybersecurity'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
    // NOTE: ISO does not publish the full standard text for free. Ingestion of this
    // document requires a licensed copy — knowledge.ingestion.service.ts refuses to
    // ingest this id without { confirmedLicensed: true }.
  },
  {
    id: 'cis-controls-8.1',
    documentTitle: 'CIS Critical Security Controls v8.1',
    version: '8.1',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['Global'],
    publicationDate: '2024-06-01',
    effectiveDate: '2024-06-01',
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://www.cisecurity.org/controls/v8-1',
    trustProfile: {
      publisher: 'Center for Internet Security (CIS)',
      authorityLevel: 'standards_body',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 95,
    },
    tags: ['controls', 'hygiene', 'safeguards'],
    category: ['framework', 'cybersecurity'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    // Not the CIS Controls v8.1 standard itself — a crosswalk/mapping document
    // published by CIS showing how v8.1 controls map to NIST CSF 2.0. Ingested
    // separately from `cis-controls-8.1` (which remains 'current'/'primary' in
    // the registry but has no ingested content yet, pending the actual standard
    // text). This mapping doc is genuinely useful as a secondary cross-reference
    // resource, just not a substitute for the primary control descriptions.
    id: 'cis-nist-csf-mapping-2024',
    documentTitle: 'CIS Controls v8.1 Mapping to NIST CSF v2.0',
    version: '2024-06-24',
    status: 'current',
    priority: 'secondary',
    jurisdictions: ['Global'],
    publicationDate: '2024-06-24',
    effectiveDate: '2024-06-24',
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://www.cisecurity.org/controls/v8-1',
    trustProfile: {
      publisher: 'Center for Internet Security (CIS)',
      authorityLevel: 'standards_body',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 90, // slightly below the primary CIS Controls entry (95) —
                       // this is a derived cross-reference document, not the
                       // primary normative source
    },
    tags: ['controls', 'mapping', 'crosswalk', 'nist-csf'],
    category: ['framework', 'cybersecurity', 'mapping'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    id: 'owasp-top10-2025',
    documentTitle: 'OWASP Top 10:2025',
    version: '2025',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['Global'],
    publicationDate: '2026-01-01',
    effectiveDate: '2026-01-01',
    deprecationDate: null,
    supersedes: ['owasp-top10-2021'],
    supersededBy: [],
    sourceUrl: 'https://owasp.org/Top10/2025/',
    trustProfile: {
      publisher: 'OWASP Foundation',
      authorityLevel: 'standards_body',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 95,
    },
    tags: ['appsec', 'web-application-security', 'owasp'],
    category: ['framework', 'appsec'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    // General/overview CISA guidance — kept as the "rolling" catch-all id since
    // it isn't tied to one specific dated publication the way the two entries
    // below are.
    id: 'cisa-guidance-rolling',
    documentTitle: 'CISA Cybersecurity Guidance (general resources)',
    version: 'rolling',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['United States', 'Global'],
    publicationDate: '2026-07-12',
    effectiveDate: null,
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://www.cisa.gov/resources-tools',
    trustProfile: {
      publisher: 'Cybersecurity and Infrastructure Security Agency (CISA)',
      authorityLevel: 'government_advisory',
      verificationStatus: 'verified',
      reviewCadence: 'quarterly',
      nextReviewDate: computeNextReviewDate('quarterly', '2026-07-12'),
      trustScore: 90,
    },
    tags: ['advisories', 'incident-response', 'best-practices'],
    category: ['guidance', 'cybersecurity'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    // Joint guidance with DoW, DOE, FBI, and Dept. of State — published
    // April 29, 2026. Confirmed via web search since this postdates my training
    // data; verified against CISA's own resource page and the CISA/DoW joint
    // press release.
    id: 'cisa-zero-trust-ot-2026',
    documentTitle: 'Adapting Zero Trust Principles to Operational Technology',
    version: '2026',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['United States', 'Global'],
    publicationDate: '2026-04-29',
    effectiveDate: '2026-04-29',
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://www.cisa.gov/resources-tools/resources/adapting-zero-trust-principles-operational-technology',
    trustProfile: {
      publisher: 'CISA (joint with Dept. of War, Dept. of Energy, FBI, Dept. of State)',
      authorityLevel: 'government_advisory',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 90,
    },
    tags: ['zero-trust', 'operational-technology', 'ics', 'critical-infrastructure'],
    category: ['guidance', 'cybersecurity', 'ot'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    // Joint guidance with NSA and five international partners (Five Eyes) —
    // published May 1, 2026. Confirmed via web search for the same reason as
    // the zero-trust OT entry above.
    id: 'cisa-agentic-ai-2026',
    documentTitle: 'Careful Adoption of Agentic AI Services',
    version: '2026',
    status: 'current',
    priority: 'primary',
    jurisdictions: ['United States', 'Global'],
    publicationDate: '2026-05-01',
    effectiveDate: '2026-05-01',
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://www.cisa.gov/resources-tools/resources/careful-adoption-agentic-ai-services',
    trustProfile: {
      publisher: 'CISA (joint with NSA, ASD ACSC, CCCS, NCSC-NZ, NCSC-UK)',
      authorityLevel: 'government_advisory',
      verificationStatus: 'verified',
      reviewCadence: 'annual',
      nextReviewDate: computeNextReviewDate('annual', '2026-07-12'),
      trustScore: 90,
    },
    tags: ['agentic-ai', 'ai-security', 'llm', 'autonomous-agents'],
    category: ['guidance', 'cybersecurity', 'ai'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    id: 'microsoft-security-best-practices-rolling',
    documentTitle: 'Microsoft Security Best Practices (rolling corpus)',
    version: 'rolling',
    status: 'current',
    priority: 'secondary',
    jurisdictions: ['Global'],
    publicationDate: '2026-07-12',
    effectiveDate: null,
    deprecationDate: null,
    supersedes: [],
    supersededBy: [],
    sourceUrl: 'https://learn.microsoft.com/en-us/security/',
    trustProfile: {
      publisher: 'Microsoft',
      authorityLevel: 'vendor_guidance',
      verificationStatus: 'verified',
      reviewCadence: 'quarterly',
      nextReviewDate: computeNextReviewDate('quarterly', '2026-07-12'),
      trustScore: 85,
    },
    tags: ['azure', 'best-practices', 'vendor-guidance'],
    category: ['guidance', 'cybersecurity'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
  {
    id: 'owasp-top10-2021',
    documentTitle: 'OWASP Top 10:2021',
    version: '2021',
    status: 'historical',
    priority: 'secondary',
    jurisdictions: ['Global'],
    publicationDate: '2021-09-24',
    effectiveDate: '2021-09-24',
    deprecationDate: '2026-01-01',
    supersedes: [],
    supersededBy: ['owasp-top10-2025'],
    sourceUrl: 'https://owasp.org/Top10/2021/',
    trustProfile: {
      publisher: 'OWASP Foundation',
      authorityLevel: 'standards_body',
      verificationStatus: 'deprecated',
      reviewCadence: 'none',
      nextReviewDate: null,
      trustScore: 40,
    },
    tags: ['appsec', 'web-application-security', 'historical'],
    category: ['framework', 'appsec'],
    language: 'en',
    translationGroupId: null,
    organizationId: null,
  },
];

export async function seedKnowledgeRegistry(container: Container): Promise<void> {
  const now = new Date().toISOString();

  for (const entry of REGISTRY_ENTRIES) {
    let existingChunkCount = 0;
    let existingLastIngestedAt = now;
    try {
      const { resource: existing } = await container.item(entry.id, entry.id).read();
      if (existing) {
        existingChunkCount = existing.chunkCount ?? 0;
        existingLastIngestedAt = existing.lastIngestedAt ?? now;
      }
    } catch (err: any) {
      if (err.code !== 404) throw err;
    }

    const document: KnowledgeDocument = {
      ...entry,
      chunkCount: existingChunkCount,
      lastIngestedAt: existingLastIngestedAt,
    };

    await container.items.upsert(document);
    console.log(`[knowledge.registry.seed] upserted: ${entry.id} (status=${entry.status}, priority=${entry.priority})`);
  }

  console.log(`[knowledge.registry.seed] done — ${REGISTRY_ENTRIES.length} registry entries in sync.`);
}

/**
 * Entrypoint for `npm run seed:knowledge-registry`. Reuses the app's existing
 * Cosmos config (config/db.ts) — same managed-identity/connection-string
 * fallback logic the rest of the app already uses, no separate env handling
 * needed here.
 */
async function main() {
  const knowledgeContainer = container('knowledge_documents');
  await seedKnowledgeRegistry(knowledgeContainer);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[knowledge.registry.seed] failed:', err);
    process.exit(1);
  });
}
