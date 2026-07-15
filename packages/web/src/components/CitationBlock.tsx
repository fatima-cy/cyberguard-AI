import { useState } from 'react';
import type { ChatSource } from '@cyberguard/shared';

/**
 * Sprint 4.1.1 — consolidated from three near-identical implementations
 * (ChatPage.tsx, PhishingPage.tsx's ResultCitations, PolicyViewer.tsx's
 * PolicyCitations), built independently across Sprints 3.1-3.3. All three
 * typed against the same ChatSource[] shape and differed only in the
 * expand-button label text — preserved here via the optional `label` prop
 * rather than losing that distinction.
 *
 * Historical sources get a visible "superseded" tag per the Sprint 3.1
 * governance rules; never presented as current law/standard.
 */
export function CitationBlock({ sources, label = 'Based on' }: { sources: ChatSource[]; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="citation-block">
      <button className="citation-toggle" onClick={() => setExpanded(v => !v)}>
        {expanded ? '▾' : '▸'} {label} {sources.length} source{sources.length > 1 ? 's' : ''}
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
