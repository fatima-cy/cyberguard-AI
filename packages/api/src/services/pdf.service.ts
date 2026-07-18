/**
 * packages/api/src/services/pdf.service.ts
 * Sprint 4.3.1 — Document Export (PDF).
 *
 * Renders a generated policy into branded HTML, then uses a headless
 * Chrome instance (puppeteer) to produce a real PDF. Chosen over pdfkit
 * specifically for visual fidelity — this is real HTML/CSS, so it can
 * actually look like a designed document rather than manually-positioned
 * text blocks. See Sprint 4.3 plan for the full library tradeoff writeup.
 */

import puppeteer, { type Browser } from 'puppeteer';
import { marked } from 'marked';
import type { GeneratedPolicy } from '@cyberguard/shared';

let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return _browser;
}

function extractTableOfContents(markdown: string): { level: number; text: string }[] {
  const lines = markdown.split('\n');
  const toc: { level: number; text: string }[] = [];
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    if (h1) toc.push({ level: 1, text: h1[1].trim() });
    else if (h2) toc.push({ level: 2, text: h2[1].trim() });
  }
  return toc;
}

function buildHtml(policy: GeneratedPolicy): string {
  const bodyHtml = marked.parse(policy.content, { async: false }) as string;
  const toc = extractTableOfContents(policy.content);
  const generatedDate = new Date(policy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const tocHtml = toc.map(item =>
    `<div class="toc-item toc-level-${item.level}">${item.text}</div>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1a1f2e;
    font-size: 11pt;
    line-height: 1.6;
    margin: 0;
    padding: 0 60px;
  }
  .cover {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    page-break-after: always;
    padding: 0 60px;
  }
  .cover-logo { font-size: 20pt; font-weight: 700; color: #0d1424; margin-bottom: 48px; }
  .cover-title { font-size: 28pt; font-weight: 700; color: #0d1424; margin: 0 0 12px; max-width: 480px; }
  .cover-subtitle { font-size: 13pt; color: #64748b; margin: 0 0 32px; }
  .cover-meta { font-size: 10pt; color: #94a3b8; }
  .toc { page-break-after: always; padding-top: 60px; }
  .toc h2 { font-size: 16pt; margin-bottom: 24px; }
  .toc-item { padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
  .toc-level-1 { font-weight: 600; font-size: 11.5pt; }
  .toc-level-2 { padding-left: 20px; font-size: 10.5pt; color: #475569; }
  .content { padding-top: 40px; }
  .content h1 { font-size: 18pt; margin-top: 0; page-break-before: always; }
  .content h1:first-child { page-break-before: avoid; }
  .content h2 { font-size: 14pt; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  .content h2:first-of-type { border-top: none; padding-top: 0; }
  .content h3 { font-size: 12pt; margin-top: 18px; }
  .content p { margin: 8px 0; }
  .content ul, .content ol { margin: 8px 0; padding-left: 22px; }
  .content li { margin-bottom: 4px; }
  .content strong { font-weight: 600; }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-logo">🛡️ CyberGuard AI</div>
    <div class="cover-title">${policy.title}</div>
    <div class="cover-subtitle">Generated for ${policy.orgContext.organizationName}</div>
    <div class="cover-meta">Generated on ${generatedDate}</div>
  </div>
  <div class="toc">
    <h2>Table of Contents</h2>
    ${tocHtml}
  </div>
  <div class="content">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

export async function generatePolicyPdf(policy: GeneratedPolicy): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildHtml(policy), { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 8pt; color: #94a3b8; text-align: center; padding: 0 60px;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>`,
      margin: { top: '20px', bottom: '40px', left: '0', right: '0' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}
