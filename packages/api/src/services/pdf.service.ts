/**
 * packages/api/src/services/pdf.service.ts
 * Sprint 4.3.1 — Document Export (PDF).
 * Sprint 4.3.2 follow-up — real CloudSecure logo instead of emoji placeholder
 */

import fs from 'fs';
import path from 'path';
import puppeteer, { type Browser } from 'puppeteer';
import { marked } from 'marked';
import type { GeneratedPolicy, PhishingAnalysis } from '@cyberguard/shared';

let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return _browser;
}

let _logoDataUri: string | null = null;
function getLogoDataUri(): string {
  if (_logoDataUri) return _logoDataUri;
  // NOTE: works correctly in dev (ts-node runs directly from src/, so
  // __dirname resolves to src/services and ../assets to src/assets). Will
  // break on a real production build — tsc compiles .ts to dist/ but does
  // NOT copy non-.ts assets like this PNG, so dist/assets/ won't exist.
  // Needs a build-script asset-copy step (or bundling the logo as a base64
  // constant instead of a file read) — flagged for Sprint 4.5 (Azure
  // Production), not fixed now since dev mode is all that exists today.
  const logoPath = path.join(__dirname, '../assets/cloudsecure-logo.png');
  const buffer = fs.readFileSync(logoPath);
  _logoDataUri = `data:image/png;base64,${buffer.toString('base64')}`;
  return _logoDataUri;
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
  const logoDataUri = getLogoDataUri();

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
  .cover-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 48px; }
  .cover-logo img { height: 32px; width: auto; }
  .cover-logo span { font-size: 16pt; font-weight: 700; color: #0d1424; }
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
    <div class="cover-logo"><img src="${logoDataUri}" alt="CloudSecure" /><span>CyberGuard AI</span></div>
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

// ─── Phishing Report Export (Sprint 4.3.3) ────────────────────────────────────

const RISK_COLOR: Record<string, string> = { LOW: '#22c55e', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' };

function buildPhishingReportHtml(analysis: PhishingAnalysis): string {
  const logoDataUri = getLogoDataUri();
  const generatedDate = new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const riskColor = RISK_COLOR[analysis.riskLevel] ?? '#64748b';

  const indicatorsHtml = analysis.indicators.map(ind => `
    <div class="indicator">
      <div class="indicator-header"><strong>${ind.type}</strong> <code>${ind.value}</code> <span class="sev sev-${ind.severity.toLowerCase()}">${ind.severity}</span></div>
      <p>${ind.description}</p>
    </div>`).join('');

  const actionsHtml = analysis.recommendedActions.map(a => `<li>${a}</li>`).join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1f2e; font-size: 11pt; line-height: 1.6; margin: 0; padding: 40px 60px; }
  .header { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
  .header img { height: 28px; }
  .header span { font-size: 14pt; font-weight: 700; }
  .risk-badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-weight: 700; font-size: 13pt; color: white; background: ${riskColor}; margin-bottom: 8px; }
  .risk-score { font-size: 10pt; color: #64748b; margin-bottom: 24px; }
  .verdict { font-size: 14pt; font-weight: 600; margin-bottom: 24px; }
  h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: 0.02em; color: #64748b; margin: 24px 0 8px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  h2:first-of-type { border-top: none; padding-top: 0; }
  .indicator { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
  .indicator-header code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 9pt; }
  .sev { font-size: 8pt; font-weight: 700; padding: 1px 8px; border-radius: 999px; margin-left: 6px; }
  .sev-high { color: #f97316; border: 1px solid #f97316; }
  .sev-medium { color: #eab308; border: 1px solid #eab308; }
  .sev-low { color: #64748b; border: 1px solid #64748b; }
  ul { padding-left: 20px; }
  .meta { font-size: 9pt; color: #94a3b8; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header"><img src="${logoDataUri}" alt="CloudSecure" /><span>CyberGuard AI — Phishing Analysis Report</span></div>
  <div class="risk-badge">${analysis.riskLevel}</div>
  <div class="risk-score">Risk Score: ${analysis.riskScore} / 100</div>
  <div class="verdict">${analysis.verdict}</div>

  <h2>Executive Summary</h2>
  <p>${analysis.executiveSummary}</p>

  <h2>Technical Summary</h2>
  <p>${analysis.technicalSummary}</p>

  <h2>Indicators of Compromise</h2>
  ${indicatorsHtml || '<p>No specific indicators detected.</p>'}

  <h2>Recommended Actions</h2>
  <ul>${actionsHtml}</ul>

  <div class="meta">Generated on ${generatedDate}</div>
</body>
</html>`;
}

export async function generatePhishingReportPdf(analysis: PhishingAnalysis): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildPhishingReportHtml(analysis), { waitUntil: 'domcontentloaded' });
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
