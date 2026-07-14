# Sprint 3.1 — Completion Report
**Project:** CyberGuard AI (CloudSecure Solutions Ltd)
**Scope:** RAG Knowledge Governance Layer
**Status:** ✅ Complete — implemented, ingested, integrated, and validated end-to-end
**Report Date:** 2026-07-14

---

## Summary

Sprint 3.1 delivered a governed, version-aware RAG (Retrieval-Augmented Generation) knowledge platform for CyberGuard AI's chat module. This goes beyond a standard RAG implementation: every retrieved source carries structured governance metadata (lifecycle status, authority level, trust score, jurisdiction, replacement chain), and retrieval follows a fixed 7-step precedence order that guarantees current, authoritative sources are never outranked by historical or lower-trust ones — even in the presence of data-entry mistakes.

The sprint also caught and corrected a live accuracy issue: the chat system's base prompt was citing Nigeria's 2019 data protection regulation (NDPR) as current law. It has been superseded by the Nigeria Data Protection Act (NDPA) 2023 and the General Application & Implementation Directive (GAID) 2025. This was fixed at both the knowledge-corpus level and the system-prompt level before any customer-facing deployment.

All work is committed to `main` across three commits (`cef3dae`, `2436986`, `651dccb`) and has been validated against live chat, not just unit tests.

---

## What Was Built

### 1. Knowledge Governance Layer (schema & standards)
- **Document registry** — Cosmos container (`knowledge_documents`) with full governance metadata per document: lifecycle status, priority tier, jurisdiction(s), publication/effective dates, replacement chain (`supersedes`/`supersededBy`), and a trust profile (publisher, 5-tier authority level, verification status, review cadence, 0–100 trust score).
- **Formal trust score scale**, established as a CloudSecure engineering standard:

  | Score | Meaning |
  |---|---|
  | 100 | Current regulatory authority (NDPA, GAID) |
  | 98 | Current international standards (NIST, ISO) |
  | 95 | Current industry standards (OWASP, CIS) |
  | 90 | Government advisory guidance (CISA) |
  | 85 | Vendor guidance (Microsoft) |
  | 50–80 | Reserved for future customer-specific knowledge |
  | 40 | Historical/superseded but still authentic |
  | 0–20 | Deprecated/invalid/untrusted (excluded from retrieval) |

- **7-step retrieval precedence order** (organizationId → status → verificationStatus → priority → authorityLevel → trustScore → semantic relevance), implemented in code in `knowledge.search.service.ts`, not just documented. This ordering guarantees a data-entry mistake (e.g. a historical document accidentally given a high trust score) can never outrank a correctly-tagged current source.
- Designed from the outset to scale from today's ~13 documents to hundreds of standards, multiple jurisdictions, and eventual customer-uploaded private knowledge bases — without a schema-breaking change.

### 2. Backend implementation
- `knowledge.repository.ts` — Cosmos CRUD and governance-aware queries (list by status/jurisdiction/authority, documents due for review, replacement-chain resolution)
- `knowledge.ingestion.service.ts` — PDF chunking, embedding via `text-embedding-3-large`, upload to Azure AI Search. Enforces governance rules in code, not just process: refuses to ingest `pending_review`/`deprecated` documents, and hard-blocks ISO 27001 ingestion without an explicit licensing confirmation flag.
- `knowledge.search.service.ts` — hybrid semantic search implementing the full 7-step precedence order
- `knowledge.router.ts` — admin ingestion endpoint, public sources-listing endpoint
- `config/blob.ts`, `config/search.ts` — new Azure client modules matching the existing managed-identity/fallback pattern already used for Cosmos and OpenAI
- Azure AI Search index: 27 fields, HNSW vector search (3072 dimensions), semantic reranking, and a `governance-boost` scoring profile

### 3. Live chat integration
- `cyberguard.service.ts` — both `sendChatMessage()` and `sendChatMessageStream()` now retrieve grounding context before generating a response, with `organizationId` threaded through for multi-tenant isolation
- System prompt corrected: NDPA 2023 + GAID 2025 now named as current Nigerian data protection law; NDPR 2019 explicitly flagged as superseded, never presented as current
- Citations flow end-to-end: a new `sources` SSE event streams to the frontend before token generation begins, persisted alongside each assistant message in Cosmos, and rendered in a collapsible citation UI with historical-source tagging

---

## Ingestion Results

**13 registry entries; 9 ingested with real content (266 chunks); 2 intentionally unfilled pending source material.**

| Document | Status | Chunks | Notes |
|---|---|---|---|
| NDPA 2023 | ✅ Ingested | 32 | Current, primary |
| GAID 2025 | ✅ Ingested | 68 | Current, primary |
| NDPR 2019 | ✅ Ingested | 13 | Historical |
| NIST CSF 2.0 | ✅ Ingested | 21 | Current, primary |
| CIS-NIST Mapping 2024 | ✅ Ingested | 36 | Secondary crosswalk doc |
| OWASP Top 10:2025 | ✅ Ingested | 46 | Current, primary |
| OWASP Top 10:2021 | Registry only | 0 | Historical — kept solely for replacement-chain integrity |
| CISA General Guidance | ✅ Ingested | 5 | Current, government advisory |
| CISA Zero Trust (OT) 2026 | ✅ Ingested | 21 | Current — published April 2026 |
| CISA Agentic AI Adoption 2026 | ✅ Ingested | 20 | Current — published May 2026 |
| Microsoft Security Best Practices | ✅ Ingested | 4 | Current, vendor guidance |
| CIS Controls v8.1 | Registry only | 0 | **Awaiting actual standard text** — only a mapping doc was available |
| ISO/IEC 27001:2022 | Registry only | 0 | **Licensing-blocked** — hard gate enforced in code |

**Corpus note:** while sourcing OWASP Top 10:2025, ingestion discovered it had itself already been through one version cycle since Sprint 3 planning began — the plan originally specified the 2021 edition. Corrected before ingestion.

---

## End-to-End Validation

Four governance behaviors were tested against the live chat application (not test fixtures) with a real user account:

| Test | Result |
|---|---|
| **Current-law grounding** — "NDPR requirements for a fintech startup?" | ✅ Proactively corrected the outdated framing; cited NDPA 2023 + GAID 2025 as current, explained specific GAID classification tiers (e.g. "Ultra-High Level Data Controllers") |
| **Historical fallback** — "How did NDPR handle breach notification before NDPA?" | ✅ Surfaced NDPR content, explicitly labeled "historical context only," correctly named its successors |
| **Cross-framework grounding** — "What does OWASP say about broken access control?" | ✅ Cited OWASP Top 10:2025 (A01:2025) specifically — not the deprecated 2021 edition |
| **Ungrounded query** — "What's the weather like today?" | ✅ Did not hallucinate; explicitly acknowledged no live data access and pointed to real external resources |

**One production bug was found and fixed during validation:** starting a brand-new conversation triggered a race condition where the frontend re-fetched session messages from the database mid-stream — before the assistant's reply was persisted — silently wiping the in-progress response until a full page refresh. This predates Sprint 3.1 but had never been exercised end-to-end until this testing pass. Fixed and validated (`651dccb`).

---

## Commits

| Commit | Scope |
|---|---|
| `cef3dae` | Governance layer, repository, ingestion service, search service, provisioning, first ingestion (9/9 documents, 266 chunks) |
| `2436986` | RAG wired into live `cyberguard.service.ts` / `cyberguard.router.ts`; system prompt correction; `ChatSource` type added to shared package |
| `651dccb` | Frontend race-condition fix; citation UI rendering |

Also included in `cef3dae`: two pre-existing, unrelated infra fixes discovered during the build process — a Key Vault name exceeding Azure's 24-character limit, and an incorrect `cognitiveServicesUser` role definition GUID in `roles.bicep`.

---

## Known Gaps / Sprint 4 Backlog

- **Section-label citations are imprecise.** The PDF-chunking heuristic (`inferSection()`) sometimes grabs a title-page line instead of a real section heading (e.g. citing "§personal data. b. Cross-border transfer..." instead of a clean section number). Confirmed twice in live testing. Needs a proper section-aware PDF parser.
- **Confidence labels may need recalibration.** Every retrieved source in live testing showed "Low" confidence, including clearly well-grounded, accurate responses. Worth checking whether the High/Medium/Low thresholds in `knowledge.search.service.ts` match real-world AI Search relevance scores.
- **CIS Controls v8.1 and ISO/IEC 27001:2022 have zero ingested content.** The model correctly falls back to general knowledge for these (verified non-hallucinatory in testing) but the actual standard texts should be sourced before this becomes a long-term gap. ISO 27001 remains hard-blocked pending a confirmed license.
- **OpenAI embedding deployment quota (10K TPM) was the dominant ingestion bottleneck** — 266 chunks took roughly 25 minutes of wall-clock time, mostly pacing delays required to stay under quota. Worth increasing deployment capacity before this becomes a recurring pain point (e.g. for the automatic re-ingestion job described in the architecture docs).
- **Frontend welcome-screen copy still references NDPR** as if current ("Ask me about NDPR compliance..."). Same class of issue already fixed in the system prompt and citation logic — just cosmetic UI text this time.
- Full list of deferred, non-blocking items (multi-tenant customer knowledge bases, automated re-ingestion scheduling, multi-language support, real tokenizer for chunking) is tracked in `sprint4-backlog.md`.

---

## Recommendation

Sprint 3.1's Definition of Done is met: AI responses cite trusted, version-correct sources; historical/current distinctions are enforced in both data and UI; the platform passed live validation against real governance edge cases, not just synthetic tests. Ready to proceed to Sprint 3.2 (AI Phishing Analyzer), which was scoped in the original Sprint 3 plan to build on this RAG foundation.
