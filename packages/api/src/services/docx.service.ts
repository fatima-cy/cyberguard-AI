/**
 * packages/api/src/services/docx.service.ts
 * Sprint 4.3.2 — Document Export (DOCX).
 * Real CloudSecure logo via ImageRun instead of emoji placeholder — same
 * dist-copy caveat as pdf.service.ts's getLogoDataUri, see that file's
 * comment for the full explanation.
 */

import fs from 'fs';
import path from 'path';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageNumber, Header, Footer, ImageRun,
} from 'docx';
import type { GeneratedPolicy, PhishingAnalysis } from '@cyberguard/shared';

let _logoBuffer: Buffer | null = null;
function getLogoBuffer(): Buffer {
  if (_logoBuffer) return _logoBuffer;
  const logoPath = path.join(__dirname, '../assets/cloudsecure-logo.png');
  _logoBuffer = fs.readFileSync(logoPath);
  return _logoBuffer;
}

function parseInlineBold(text: string): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map(part => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) return new TextRun({ text: boldMatch[1], bold: true });
    return new TextRun({ text: part });
  });
}

function markdownToParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    const h4 = line.match(/^####\s+(.+)/);
    const bullet = line.match(/^[-*]\s+(.+)/);
    const hr = line.match(/^---+$/);

    if (hr) {
      paragraphs.push(new Paragraph({ text: '', border: { bottom: { color: 'CCCCCC', space: 1, style: 'single', size: 6 } } }));
    } else if (h1) {
      paragraphs.push(new Paragraph({ children: parseInlineBold(h1[1]), heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
    } else if (h2) {
      paragraphs.push(new Paragraph({ children: parseInlineBold(h2[1]), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    } else if (h3) {
      paragraphs.push(new Paragraph({ children: parseInlineBold(h3[1]), heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } }));
    } else if (h4) {
      paragraphs.push(new Paragraph({ children: parseInlineBold(h4[1]), heading: HeadingLevel.HEADING_4, spacing: { before: 120, after: 60 } }));
    } else if (bullet) {
      paragraphs.push(new Paragraph({ children: parseInlineBold(bullet[1]), bullet: { level: 0 }, spacing: { after: 60 } }));
    } else {
      paragraphs.push(new Paragraph({ children: parseInlineBold(line), spacing: { after: 100 } }));
    }
  }

  return paragraphs;
}

export async function generatePolicyDocx(policy: GeneratedPolicy): Promise<Buffer> {
  const generatedDate = new Date(policy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const logoBuffer = getLogoBuffer();

  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({ data: logoBuffer, transformation: { width: 63, height: 40 }, type: 'png' }),
              new TextRun({ text: '  CyberGuard AI', bold: true, size: 18 }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
              new TextRun({ text: ' / ', size: 16 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({ text: policy.title, heading: HeadingLevel.TITLE, spacing: { after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: `Generated for ${policy.orgContext.organizationName} on ${generatedDate}`, italics: true, color: '64748B' })], spacing: { after: 300 } }),
        ...markdownToParagraphs(policy.content),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

// ─── Phishing Report Export (Sprint 4.3.3) ────────────────────────────────────

export async function generatePhishingReportDocx(analysis: PhishingAnalysis): Promise<Buffer> {
  const generatedDate = new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const logoBuffer = getLogoBuffer();

  const indicatorParagraphs = analysis.indicators.flatMap(ind => [
    new Paragraph({
      children: [
        new TextRun({ text: `${ind.type}: `, bold: true }),
        new TextRun({ text: ind.value }),
        new TextRun({ text: `  [${ind.severity}]`, bold: true, color: ind.severity === 'HIGH' ? 'F97316' : ind.severity === 'MEDIUM' ? 'EAB308' : '64748B' }),
      ],
      spacing: { before: 100 },
    }),
    new Paragraph({ children: [new TextRun({ text: ind.description, color: '64748B' })], spacing: { after: 80 } }),
  ]);

  const actionParagraphs = analysis.recommendedActions.map(a =>
    new Paragraph({ children: [new TextRun({ text: a })], bullet: { level: 0 }, spacing: { after: 60 } }),
  );

  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({ data: logoBuffer, transformation: { width: 63, height: 40 }, type: 'png' }),
              new TextRun({ text: '  CyberGuard AI', bold: true, size: 18 }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
              new TextRun({ text: ' / ', size: 16 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({ text: 'Phishing Analysis Report', heading: HeadingLevel.TITLE, spacing: { after: 60 } }),
        new Paragraph({
          children: [
            new TextRun({ text: `${analysis.riskLevel}  `, bold: true, size: 28 }),
            new TextRun({ text: `Risk Score: ${analysis.riskScore} / 100`, color: '64748B' }),
          ],
          spacing: { after: 120 },
        }),
        new Paragraph({ children: [new TextRun({ text: analysis.verdict, bold: true })], spacing: { after: 240 } }),

        new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: analysis.executiveSummary })], spacing: { after: 200 } }),

        new Paragraph({ text: 'Technical Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: analysis.technicalSummary })], spacing: { after: 200 } }),

        new Paragraph({ text: 'Indicators of Compromise', heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 80 } }),
        ...(indicatorParagraphs.length > 0 ? indicatorParagraphs : [new Paragraph({ text: 'No specific indicators detected.' })]),

        new Paragraph({ text: 'Recommended Actions', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }),
        ...actionParagraphs,

        new Paragraph({ children: [new TextRun({ text: `Generated on ${generatedDate}`, italics: true, size: 16, color: '94A3B8' })], spacing: { before: 300 } }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
