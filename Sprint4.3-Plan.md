# Sprint 4.3 — Plan
**Project:** CyberGuard AI (CloudSecure Solutions Ltd)
**Objective:** Document Export — branded, downloadable DOCX/PDF for generated policies (and phishing reports as a stretch)
**Status:** Scoped — ready to build

---

## What Discovery Confirmed

- No document-generation library installed at all (`docx`, `pdfkit`, `puppeteer` all absent from `packages/api/package.json`)
- `Organisation` type has no branding fields (logo URL, custom colors) — export will use the CloudSecure/CyberGuard brand identity we already built in Sprint 4.1.6, not per-org custom branding. Per-org branding (e.g. a client's own logo on their policy exports) is a real future feature but out of scope here — no evidence it's needed yet, and adding it means an org logo-upload flow that doesn't exist
- `GeneratedPolicy.content` is markdown (from `policies.service.ts`'s AI generation) — export needs to render that markdown into proper document structure (headings, lists, bold), not just dump raw markdown text into a PDF

## Library Decision

- **DOCX**: `docx` npm package — pure JS, no extra runtime dependency
- **PDF**: `puppeteer` (headless Chrome) — chosen over `pdfkit` for visual fidelity; HTML/CSS-styled documents can actually match the brand, versus `pdfkit`'s manual coordinate-based text placement. Real tradeoff: adds a Chromium binary to the deploy, meaningfully larger container size and slower cold starts — accepted as a one-time infra cost to be handled properly in Sprint 4.5, rather than a permanent quality ceiling on every document

---

## Build Sequence

```
4.3.1 — PDF export for policies      (primary target — the CTO's "beautifully branded PDF" example)
    ↓
4.3.2 — DOCX export for policies      (editable format — enterprises often want to customize before adopting)
    ↓
4.3.3 — Phishing report export        (stretch — same underlying pipeline, lower priority than policies)
```

## 4.3.1 — PDF Export for Policies

**Backend:**
- Install `puppeteer` in `packages/api`
- New `packages/api/src/services/pdf.service.ts` — renders a policy into branded HTML (CloudSecure logo, org name, policy title, generated-on date, page numbers, table of contents derived from the markdown headings), then uses puppeteer to render that HTML to a PDF buffer
- Markdown-to-HTML conversion needed for the policy content itself — likely `marked` (Node-side equivalent of what `react-markdown` already does client-side) rather than hand-rolling a parser
- New endpoint: `GET /api/v1/policies/:id/export/pdf` — streams the generated PDF as a download (`Content-Disposition: attachment`)

**Frontend:**
- "Export PDF" button on `PolicyViewer.tsx`, triggers a direct download

## 4.3.2 — DOCX Export for Policies

**Backend:**
- Install `docx` in `packages/api`
- New `packages/api/src/services/docx.service.ts` — same markdown-to-structure approach, but building a `docx` `Document` object (headings, paragraphs, lists) instead of HTML
- New endpoint: `GET /api/v1/policies/:id/export/docx`

**Frontend:**
- "Export Word" button alongside "Export PDF" on `PolicyViewer.tsx`

## 4.3.3 — Phishing Report Export (stretch)

Same PDF/DOCX pipeline, applied to `PhishingAnalysis` instead of `GeneratedPolicy` — lower priority since phishing analyses are typically consumed in-app for immediate action, not circulated as formal documents the way policies are. Build only if 4.3.1/4.3.2 land cleanly with time to spare.

---

## Explicitly Out of Scope for 4.3

- Per-organization custom branding (client's own logo instead of CloudSecure's) — no upload flow exists, no evidence of demand yet
- Export of chat conversations — not a document-shaped artifact, doesn't fit this pattern
- Batch export (multiple policies at once) — no evidence of need, adds real complexity for an unrequested feature

## Definition of Done — Sprint 4.3

- [ ] A generated policy can be downloaded as a real, branded PDF with page numbers and a table of contents
- [ ] The same policy can be downloaded as an editable DOCX
- [ ] Both exports render the markdown content correctly (headings, bold, lists — not raw markdown syntax visible in the output)
- [ ] No regression in any existing functionality
