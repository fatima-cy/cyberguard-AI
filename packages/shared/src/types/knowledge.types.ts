/**
 * packages/shared/src/types/knowledge.types.ts
 *
 * Shared types for the CyberGuard AI Knowledge Governance Layer.
 * Used by: knowledge.repository.ts, knowledge.search.service.ts,
 * knowledge.ingestion.service.ts, knowledge.registry.seed.ts.
 *
 * Design goals (per CTO directive, Sprint 3.1):
 *  - Scale from 9 seed documents to hundreds/thousands without a breaking schema change
 *  - Support multiple jurisdictions per document (not just one)
 *  - Support a full trust/provenance profile (publisher, authority level, verification, review cadence)
 *  - Support deprecation and replacement chains, not just a single supersededBy pointer
 *  - Support tags/categories for faceted retrieval as the corpus grows
 *  - Support future multi-language variants of the same logical document
 */

/** Lifecycle state of a document in the registry. */
export type DocumentStatus = 'current' | 'historical' | 'deprecated' | 'pending_review';

/** Retrieval priority tier. Numeric rank is derived from this for AI Search scoring — see knowledge.registry.seed.ts. */
export type DocumentPriority = 'primary' | 'secondary' | 'tertiary';

/**
 * Who stands behind this document, and how authoritative it is.
 * This is the "trust profile" the CTO asked to design for now, even though
 * Sprint 3 only populates it for the 9 seed documents.
 */
export type AuthorityLevel =
  | 'regulatory'          // government/regulatory body — e.g. NDPC, a data protection authority
  | 'standards_body'      // e.g. NIST, ISO, CIS, OWASP
  | 'government_advisory' // government-issued guidance that is authoritative but not legally binding — e.g. CISA
  | 'vendor_guidance'      // e.g. Microsoft — commercial vendor best practices
  | 'internal_knowledge';  // customer-uploaded internal policy — lowest default authority, highest specificity

export type VerificationStatus = 'verified' | 'pending_review' | 'deprecated';

/** How often the document should be re-checked against its source for changes. */
export type ReviewCadence = 'quarterly' | 'annual' | 'rolling' | 'none';

/**
 * Full registry entry for one logical document (which may span many chunks
 * in Azure AI Search). This is the Cosmos-side source of truth; the AI Search
 * index carries a denormalized subset of these fields for filtering at query time.
 */
export interface KnowledgeDocument {
  /** Deterministic slug id, e.g. "ndpa-2023", "owasp-top10-2025". Never reused across unrelated documents. */
  id: string;

  documentTitle: string;

  /** Free-text version label — "2023", "2025", "8.1", "2.0". Not assumed to be numeric or comparable. */
  version: string;

  status: DocumentStatus;

  priority: DocumentPriority;

  /**
   * Multiple jurisdictions supported from day one (e.g. an ISO standard is "Global";
   * a future EU customer's GDPR corpus would be ["EU", "DE", "FR"] etc.)
   * Sprint 3 seed data uses single-element arrays.
   */
  jurisdictions: string[];

  publicationDate: string;        // ISO 8601 date
  effectiveDate: string | null;   // ISO 8601 date — null if not applicable / not yet in force
  deprecationDate: string | null; // ISO 8601 date — set when status becomes 'deprecated'

  /**
   * Replacement chain, not just a single link. A document can supersede more than
   * one prior document (e.g. GAID superseded both NDPR and its Implementation Framework),
   * and could in principle itself be superseded by more than one successor across split standards.
   */
  supersedes: string[];       // ids of documents this one replaces
  supersededBy: string[];     // ids of documents that replace this one

  sourceUrl: string;

  /** Trust / provenance profile — see CTO note on knowledge source provenance. */
  trustProfile: {
    publisher: string;                    // e.g. "NDPC", "NIST", "ISO", "OWASP Foundation", "Microsoft", "CISA"
    authorityLevel: AuthorityLevel;
    verificationStatus: VerificationStatus;
    reviewCadence: ReviewCadence;
    nextReviewDate: string | null;        // ISO 8601 date, derived from reviewCadence at seed/ingest time
    /**
     * Numeric trust signal, 0–100, additional to (not a replacement for) `priority`
     * and `authorityLevel`. Not user-facing — no UI surfaces this directly. Available
     * to the retrieval engine as an extra ranking input once Sprint 4+ tuning wires it
     * into the AI Search scoring profile; Sprint 3.1 only needs to populate it correctly.
     * `internal_knowledge` documents are expected to set this per-customer rather than
     * defaulting it, since a customer's own policy authority varies by organization.
     */
    trustScore: number;
  };

  /** Faceted classification — populated lightly in Sprint 3, designed for growth. */
  tags: string[];       // e.g. ["data-protection", "breach-notification", "consent"]
  category: string[];   // e.g. ["regulation", "privacy"], ["framework", "appsec"]

  /**
   * ISO 639-1 language code. Multi-language variants of the same logical document
   * are modeled as separate registry entries sharing a `translationGroupId`, not as
   * one entry with embedded translations — keeps chunking/embedding per-language clean.
   */
  language: string;
  translationGroupId: string | null;

  /**
   * Set when this document belongs to a specific customer's private knowledge base
   * rather than the shared trusted corpus (supports the "internal customer knowledge
   * bases" future-proofing requirement). Null for the shared/global corpus.
   */
  organizationId: string | null;

  chunkCount: number;
  lastIngestedAt: string;   // ISO 8601 timestamp
}

/**
 * Denormalized subset of KnowledgeDocument stored on every chunk in Azure AI Search,
 * so retrieval-time filtering/boosting doesn't require a Cosmos round-trip.
 * Field names here match the AI Search index schema exactly.
 */
export interface KnowledgeChunkIndexFields {
  id: string;                 // chunk id, e.g. "ndpa-2023__chunk-0042"
  documentId: string;         // parent KnowledgeDocument.id
  content: string;
  embedding: number[];        // text-embedding-3-large, 3072 dimensions
  documentTitle: string;
  source: string;
  section: string;
  chunkIndex: number;
  version: string;
  status: DocumentStatus;
  priority: DocumentPriority;
  priorityRank: number;       // numeric projection of priority for AI Search magnitude scoring (see seed script)
  jurisdiction: string[];
  publicationDate: string;
  effectiveDate: string | null;
  supersedes: string[];
  supersededBy: string[];
  sourceUrl: string;
  publisher: string;
  authorityLevel: AuthorityLevel;
  verificationStatus: VerificationStatus;
  trustScore: number;
  tags: string[];
  category: string[];
  language: string;
  organizationId: string | null;
  lastIngestedAt: string;
}
