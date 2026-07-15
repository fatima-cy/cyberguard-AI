import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CitationBlock } from './CitationBlock';
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
        <CopyButton text={policy.content} />
      </div>
    </div>
  );
}
