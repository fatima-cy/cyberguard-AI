import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CitationBlock } from './CitationBlock';
import { getAccessToken } from '../api/client';
import type { GeneratedPolicy } from '@cyberguard/shared';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
  }
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy policy text">
      {copied ? '✓ Copied' : 'Copy Policy'}
    </button>
  );
}

// Sprint 4.3.1 — PDF export. Uses fetch (not a plain <a href>) because the
// endpoint requires an Authorization header, which a direct link can't
// send — so we fetch the PDF as a blob and trigger the download manually.
function ExportPdfButton({ policyId, policyTitle }: { policyId: string; policyTitle: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/v1/policies/${policyId}/export/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${policyTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <button className="copy-btn" onClick={handleExport} disabled={exporting} title="Download as PDF">
        {exporting ? 'Exporting…' : '📄 Export PDF'}
      </button>
      {error && <span className="chat-error" style={{ marginLeft: '0.5rem' }}>{error}</span>}
    </>
  );
}

export function PolicyViewer({ policy }: { policy: GeneratedPolicy }) {
  return (
    <div className="policy-viewer">
      <div className="policy-viewer-header">
        <h3>{policy.title}</h3>
        <span className="text-muted">{new Date(policy.createdAt).toLocaleString()}</span>
      </div>
      <div className="policy-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{policy.content}</ReactMarkdown>
      </div>
      <CitationBlock sources={policy.sources} label="Grounded in" />
      <div className="policy-viewer-actions">
        <ExportPdfButton policyId={policy.id} policyTitle={policy.title} />
        <CopyButton text={policy.content} />
      </div>
    </div>
  );
}
