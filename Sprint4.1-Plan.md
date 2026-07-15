# Sprint 4.1 — Plan
**Project:** CyberGuard AI (CloudSecure Solutions Ltd)
**Objective:** UI Polish — make the platform look and feel like a commercial SaaS product, not three separate demos stitched together
**Status:** Approved to begin (CTO directive, post-Sprint-3-close)

---

## Strategic Framing

Sprint 3 built three working AI modules validated against real usage. Sprint 4.1 does not add capability — it makes the existing capability trustworthy at a glance. The test for this sprint:

> *Would a security-conscious enterprise buyer, seeing this for 30 seconds, believe it's a real product rather than a prototype?*

This sprint deliberately does **not** touch AI logic, retrieval, or generation — only presentation. Anything requiring backend/API changes belongs to a later Sprint 4.x (enterprise features, export, hardening), not here.

---

## Known Gaps Going In (from Sprint 3 live testing)

These are concrete, evidence-based findings from the last several weeks of validation, not speculation:

| Gap | Source | Sprint 4.1 scope? |
|---|---|---|
| Confidence labels show "Low" even for clearly well-grounded, accurate content | Sprints 3.1–3.3 testing; CTO flagged explicitly | ✅ Yes — display/calibration |
| PDF section labels in citations are garbled (title-page lines, not real headings) | Sprints 3.1–3.3 testing | ⚠️ Partial — display can be improved now; true fix needs ingestion changes (Sprint 4.x backend) |
| Citation block is a plain expandable list, no visual hierarchy | CTO review (Sprint 3.3) | ✅ Yes |
| No dashboard stats/charts — `DashboardSummary` type exists but UI is unconfirmed/basic | Original build, unreviewed this session | ✅ Yes, pending file review |
| No nav for `/policies`/`/phishing` was missing until manually added; app still feels like separate pages, not one product | CTO review | ✅ Yes |
| No mobile responsiveness confirmed on Phishing/Policies pages (only `.chat-panel`/`.main-panel` had mobile CSS) | Inferred from Sprint 2.6 mobile note only covering chat/dashboard | ✅ Yes |
| No loading skeleton on Phishing/Policies generation — just a disabled button with text | Built this session, not polished | ✅ Yes |
| No consistent empty-state treatment across pages | Inferred | ✅ Yes |

---

## Build Sequence

```
4.1.1 — Citation & confidence display overhaul   (highest-visibility fix, CTO called out explicitly)
    ↓
4.1.2 — Dashboard redesign                        (first thing every user sees)
    ↓
4.1.3 — Navigation & layout polish                 (ties the three modules into one product)
    ↓
4.1.4 — Loading & empty states                     (consistency pass across all pages)
    ↓
4.1.5 — Mobile responsiveness audit                 (verify/extend existing Sprint 2.6 work to Phishing/Policies)
    ↓
4.1.6 — Branding pass                               (logo, favicon, consistent typography — lowest risk, do last)
```

---

## 4.1.1 — Citation & Confidence Display Overhaul

**Problem (from CTO review):** current citation block is a flat list:
```
Grounded in 5 sources
▸ General Application & Implementation Directive (GAID) 2025 §... [LOW] [source]
```
"LOW" next to a clearly authoritative, well-grounded source is a trust-damaging signal, not an honest one.

**Root cause:** `confidenceLabel` in `knowledge.search.service.ts` is derived purely from `@search.score` (High >0.8, Medium >0.6, Low otherwise) — a raw hybrid-search relevance score, not a measure of grounding quality. AI Search hybrid scores in the 0.3–0.5 range are actually *normal and good* for RAG use cases; the thresholds were set without calibrating against this deployment's actual score distribution.

**Scope for this sprint:**
- Recalibrate the High/Medium/Low thresholds against real observed scores from Sprint 3 testing (need to pull actual `relevanceScore` values from logged analyses to set sane cutoffs — this is a data-driven fix, not a guess)
- Redesign the citation UI per the CTO's suggested shape — group by document rather than raw list, surface authority level and status prominently:
  ```
  Grounded By
  ✓ NDPA 2023        Regulatory · Current
  ✓ GAID 2025         Regulatory · Current
  ```
- This touches: `knowledge.search.service.ts` (threshold recalibration), and the citation components in `ChatPage.tsx`, `PhishingPage.tsx`, `PolicyViewer.tsx` (currently three near-duplicate implementations — worth consolidating into one shared `CitationBlock.tsx` component during this pass, since we've now built the same block three times)

**Deliverable:** `packages/web/src/components/CitationBlock.tsx` — one shared component replacing three duplicated implementations, imported by all three pages.

---

## 4.1.2 — Dashboard Redesign

**Status: needs discovery first.** `DashboardPage.tsx` was built in Sprint 1/2 and hasn't been reviewed this session — before proposing changes, need to see what's actually there.

**Known from `dashboard.api.ts`:** `DashboardSummary` currently only returns `stats: { conversations: number; lastActive: string | null }` — no phishing-analysis count, no policies-generated count, no risk trend. A real dashboard for a platform with three modules needs to surface activity across all three, not just chat.

**Scope for this sprint:**
- Extend `DashboardSummary` (backend) to include phishing and policy stats
- Redesign the dashboard UI to show all three modules' activity at a glance — likely a stat-card grid (conversations, analyses run, policies generated, last activity) plus a simple activity feed
- Charts are explicitly CTO-requested — start simple (a basic bar/line via `recharts` or similar, already available per the environment's library list) rather than over-building

---

## 4.1.3 — Navigation & Layout Polish

**Scope:**
- Review `Layout.tsx`'s nav — currently a flat list (Dashboard, AI Assistant, Phishing Analyzer, Policy Generator). Consider grouping ("AI Tools" section) as the module count grows
- Consistent page headers across all four pages (Dashboard/Chat/Phishing/Policies currently have inconsistent header treatments — `PhishingPage`/`PoliciesPage` use an ad-hoc `<h2>` + `<p>`, `ChatPage` has no page header at all, `DashboardPage` unknown until reviewed)
- Active-state and hover polish on nav items

---

## 4.1.4 — Loading & Empty States

**Scope:**
- Phishing/Policies generation currently just disables the button and changes its text ("Analyzing…", "Generating… (can take up to 90s)") — add a proper loading indicator given generation can take up to 90 seconds; a static disabled button with no progress signal for 90 seconds reads as broken, not busy
- Standardize empty states (no saved policies, no analyses, no conversations) — currently each page has a slightly different plain-text treatment
- Consider a lightweight progress indicator for the 90-second policy generation specifically, since that's the longest wait in the product by far

---

## 4.1.5 — Mobile Responsiveness Audit

**Scope:**
- Confirm Sprint 2.6's mobile CSS (`.main-panel`, `.chat-panel` width/padding rules) actually covers `.phishing-panel` — it currently does not appear to (the media query block only lists `.main-panel, .chat-panel`)
- Test the tabbed Phishing input, the Policies dropdowns, and the citation block specifically at mobile widths — none of these were built with mobile in mind this session
- Add `.phishing-panel`, `.policy-viewer` to the existing mobile breakpoint rules at minimum

---

## 4.1.6 — Branding Pass

**Scope (lowest risk, do last):**
- Replace the 🛡️ emoji logo with CloudSecure's actual logo asset (sky-blue/navy cloud, per brand assets built earlier)
- Add a proper favicon
- Confirm typography consistency (the existing `--font` stack is system fonts only — fine for MVP, revisit only if there's a brand font requirement)

---

## Explicitly Out of Scope for 4.1

Per the CTO's own phasing, these belong to later Sprint 4.x work, not this one:
- Document export (DOCX/PDF) — Sprint 4.3
- User roles, org settings, audit logs — Sprint 4.2
- Azure production environment, CI/CD — Sprint 4.5
- Security hardening (MFA, rate limiting review, CSP headers) — Sprint 4.6
- True PDF section-label fix (needs a real PDF structure parser in `knowledge.ingestion.service.ts`, not a UI change) — flagged for a future ingestion-focused sprint, not 4.1

---

## Definition of Done — Sprint 4.1

- [ ] Confidence label thresholds recalibrated against real observed relevance scores, not a guess
- [ ] Single shared `CitationBlock.tsx` component replacing the three duplicated implementations
- [ ] Dashboard shows activity across all three modules (chat, phishing, policies), not just chat
- [ ] Consistent page headers across all four main pages
- [ ] Loading states added for the two long-running operations (phishing analysis, policy generation)
- [ ] Mobile CSS extended to cover Phishing and Policies pages
- [ ] Logo/favicon replaced with real brand assets
- [ ] No regression in any Sprint 3 functionality — re-run the four governance validation queries from Sprint 3.1 and the two live-generation tests from Sprints 3.2/3.3 after this sprint to confirm
