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

// Sprint 4.3.1/4.3.2 — Export buttons. Uses fetch (not a plain <a href>)
// because these endpoints require an Authorization header, which a direct
// link can't send — so we fetch the file as a blob and trigger the
// download manually. Shared between PDF and DOCX since the logic is
// identical apart from the URL/filename extension/label.
function ExportButton({ policyId, policyTitle, format, label, icon }: {
  policyId: string; policyTitle: string; format: 'pdf' | 'docx'; label: string; icon: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/v1/policies/${policyId}/export/${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${policyTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${format}`;
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
      <button className="copy-btn" onClick={handleExport} disabled={exporting} title={`Download as ${format.toUpperCase()}`}>
        {exporting ? 'Exporting…' : `${icon} ${label}`}
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
        <ExportButton policyId={policy.id} policyTitle={policy.title} format="pdf" label="Export PDF" icon="📄" />
        <ExportButton policyId={policy.id} policyTitle={policy.title} format="docx" label="Export Word" icon="📝" />
        <CopyButton text={policy.content} />
      </div>
    </div>
  );
}
