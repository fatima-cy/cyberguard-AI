import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

function PolicyCitations({ sources }: { sources: GeneratedPolicy['sources'] }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div className="citation-block">
      <button className="citation-toggle" onClick={() => setExpanded(v => !v)}>
        {expanded ? '▾' : '▸'} Grounded in {sources.length} source{sources.length > 1 ? 's' : ''}
      </button>
      {expanded && (
        <ul className="citation-list">
          {sources.map((s, i) => (
            <li key={i} className={`citation-item ${s.status === 'historical' ? 'citation-historical' : ''}`}>
              <span className="citation-title">{s.documentTitle}{s.section ? ` §${s.section}` : ''} (v{s.version})</span>
              {s.historicalNotice && <span className="citation-historical-tag"> — {s.historicalNotice}</span>}
              <span className={`citation-confidence citation-confidence-${s.confidenceLabel.toLowerCase()}`}>{s.confidenceLabel}</span>
              {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="citation-link">source</a>}
            </li>
          ))}
        </ul>
      )}
    </div>
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
      <PolicyCitations sources={policy.sources} />
      <div className="policy-viewer-actions">
        <CopyButton text={policy.content} />
      </div>
    </div>
  );
}
