# Sprint 3.2 — Completion Report
**Project:** CyberGuard AI (CloudSecure Solutions Ltd)
**Scope:** AI Phishing Analyzer
**Status:** ✅ Complete — backend and frontend built, integrated, and validated end-to-end
**Report Date:** 2026-07-14

---

## Summary

Sprint 3.2 delivered CyberGuard AI's second AI-native module: an email/URL/metadata phishing analyzer that produces a structured risk assessment grounded in the same governed knowledge corpus built in Sprint 3.1. Per the CTO's directive, this was built with no architectural redesign — it reuses Sprint 3.1's `KnowledgeSearchService`, Azure OpenAI client, and citation type end to end rather than introducing new infrastructure.

Live testing surfaced and fixed one real accuracy issue in the shared retrieval layer (not specific to phishing) and two frontend bugs — one a genuine gap left over from Sprint 3.1, one new to this sprint. All are fixed, validated, and committed.

---

## What Was Built

### Backend
- `POST /api/v1/phishing/analyze` — accepts email content, URL, sender domain, subject, and/or attachment names; returns a structured risk assessment
- `GET /api/v1/phishing/analyses` — paginated analysis history per organization
- Structured JSON-mode analysis via GPT: risk score (0–100), risk level (LOW/MEDIUM/HIGH/CRITICAL), executive summary, technical summary, categorized indicators (URL/DOMAIN/SUBJECT/SENDER/ATTACHMENT) with severity, and recommended actions
- Response shape and value ranges validated before persistence — malformed model output is rejected rather than silently stored
- New Cosmos container `phishing_analyses` (`/organizationId` partition key, matching the existing chat data convention)

### Frontend
- `PhishingPage.tsx` at `/phishing` — tabbed input (Email / URL / Metadata), SVG risk gauge, indicator list with severity color-coding, recommended actions, citation display, copy-to-clipboard report export, and an analysis history sidebar
- `RiskScoreGauge.tsx` — color-coded donut gauge (green→yellow→orange→red across LOW→CRITICAL)
- Nav link added to the persistent sidebar, visible from every page

---

## Issues Found and Fixed During Validation

### 1. Retrieval grounding bug (shared infrastructure, not phishing-specific)
Live testing on an obvious phishing sample (a fake NIBSS — Nigeria's interbank settlement system — credential-harvesting email) initially returned **5 of 5 grounding sources from GAID** (a privacy regulation) and **zero from OWASP or CISA**, despite OWASP/CISA being clearly more relevant to a technical phishing pattern. The technical summary awkwardly forced a citation to GAID's "ultimate or decisive credentials" language to justify the mismatch.

**Root cause:** the 7-step retrieval precedence order established in Sprint 3.1 ranks `authorityLevel` (regulatory > standards_body > government_advisory) *before* semantic relevance. That's correct for "what does current law say" chat questions, but wrong here — GAID's higher authority tier was steamrolling more topically-relevant OWASP/CISA guidance regardless of actual fit.

**Fix:** added an optional `categories` filter to `knowledge.search.service.ts`, applied as a hard pre-filter *before* the authority-precedence order runs. This is opt-in per caller — chat's existing grounding behavior is completely unaffected. The phishing analyzer now scopes retrieval to `['appsec', 'cybersecurity']` categories, with a fallback to unscoped search if that returns nothing. Also added an explicit instruction to the analysis prompt against forcing citations that don't genuinely fit.

**Verified:** re-ran the identical test sample post-fix — 5/5 sources now correctly OWASP Top 10:2025, citing relevant CWEs (CWE-290 Authentication Bypass by Spoofing, CWE-940 Improper Verification of Source of a Communication Channel). Technical summary now reads coherently.

### 2. Citation UI was completely unstyled (Sprint 3.1 carryover)
The `sources` SSE event and citation-rendering logic built in Sprint 3.1 worked correctly at the data layer, but the corresponding CSS was never written — the citation block has been rendering with zero styling since it was first wired up. Not caught until this sprint's frontend testing. Fixed with a full citation-block/citation-item/citation-confidence stylesheet addition; now renders correctly in both the chat and phishing UIs (shared component).

### 3. Phishing results page had no scroll handling
`.phishing-panel` had no `overflow-y` set and wasn't part of any flex/scroll container, so analysis results taller than the viewport (technical summary, indicators, recommended actions, citations) were completely unreachable — visible in the UI but impossible to scroll to. Fixed to match the existing `.main-panel` pattern already used elsewhere in the app (`flex: 1; overflow-y: auto`).

---

## Validation

Two live test cases through the actual UI (not curl/API-only):

| Input | Risk Score | Risk Level | Notes |
|---|---|---|---|
| Full email content — fake NIBSS credential-harvesting attempt | 88 | CRITICAL | Correctly detected domain impersonation, urgency language, HTTP (not HTTPS), credential-harvesting URL pattern. Grounded in OWASP Top 10:2025 with relevant CWEs after the retrieval fix. |
| Subject line only, no other fields | 72 | HIGH | Correctly scored lower than the full-email case given less available evidence; model explicitly noted "No sender, URL, or attachment details were provided, limiting deeper technical validation" rather than overconfidently inflating the assessment on sparse input. |

Both cases confirm the analyzer scales its confidence appropriately to available evidence rather than defaulting to a fixed severity regardless of input completeness.

---

## Commits

| Commit | Scope |
|---|---|
| `c2c008b` | Backend: analyze/history endpoints, structured analysis service, repository; retrieval category-scoping fix in `knowledge.search.service.ts` |
| `171f3ed` | Frontend: `PhishingPage.tsx`, `RiskScoreGauge.tsx`, API client, routing; citation CSS fix; scroll-handling fix |
| `f486d9d` | Persistent nav link |

---

## Known Gaps

- **No navigation from the marketing/website side yet** — `/phishing` is reachable within the app but not yet linked from any external entry point. Noted as a "link everything to the website later" task, outside this sprint's scope.
- Same PDF section-labeling and confidence-calibration issues flagged in the Sprint 3.1 report apply here too, since phishing analysis uses the same underlying corpus and search service — no new instances specific to phishing were found, but no additional mitigation was attempted in this sprint either.
- Attachment-name analysis is currently a plain string match (no actual file scanning) — consistent with the original Sprint 3 plan's note that real attachment scanning is a Sprint 4 item slotting into `phishing.service.ts` without router changes.

---

## Recommendation

Sprint 3.2's scope is met: a working, grounded, validated phishing analyzer reusing Sprint 3.1's infrastructure with no architectural redesign, plus one meaningful improvement to the shared retrieval layer that benefits future modules doing technical (non-legal) grounding. Ready to proceed to Sprint 3.3 (Security Policy Generator) per the original Sprint 3 sequencing, which follows the same analysis-module pattern now established twice.
