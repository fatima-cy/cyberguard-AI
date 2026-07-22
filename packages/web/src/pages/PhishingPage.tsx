import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/auth.context';
import { phishingApi } from '../api/dashboard.api';
import { Layout } from '../components/Layout';
import { RiskScoreGauge } from '../components/RiskScoreGauge';
import { CitationBlock } from '../components/CitationBlock';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { getAccessToken, apiUrl } from '../api/client';
import type { PhishingAnalysis, PhishingAnalysisInput } from '@cyberguard/shared';

const ANALYSIS_LOADING_MESSAGES = [
  'Analyzing indicators…',
  'Checking domain reputation…',
  'Grounding in OWASP and CISA guidance…',
  'Assessing risk severity…',
  'Compiling recommended actions…',
];

type InputTab = 'email' | 'url' | 'metadata';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
  }
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy report">
      {copied ? '✓ Copied' : 'Copy Report'}
    </button>
  );
}

// Sprint 4.3.3 — export buttons, same fetch-as-blob pattern as PolicyViewer's.
function ExportButton({ analysisId, format, label, icon }: {
  analysisId: string; format: 'pdf' | 'docx'; label: string; icon: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const token = getAccessToken();
      const response = await fetch(apiUrl(`/api/v1/phishing/analyses/${analysisId}/export/${format}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phishing-analysis-${analysisId.slice(0, 8)}.${format}`;
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

function analysisToPlainText(a: PhishingAnalysis): string {
  return [
    `PHISHING ANALYSIS — Risk: ${a.riskLevel} (${a.riskScore}/100)`,
    `Verdict: ${a.verdict}`,
    ``,
    `Executive Summary:\n${a.executiveSummary}`,
    ``,
    `Technical Summary:\n${a.technicalSummary}`,
    ``,
    `Indicators:`,
    ...a.indicators.map(i => `- [${i.severity}] ${i.type}: ${i.value} — ${i.description}`),
    ``,
    `Recommended Actions:`,
    ...a.recommendedActions.map(r => `- ${r}`),
  ].join('\n');
}

function IndicatorList({ indicators }: { indicators: PhishingAnalysis['indicators'] }) {
  if (indicators.length === 0) return <p className="text-muted">No specific indicators detected.</p>;
  return (
    <ul className="indicator-list">
      {indicators.map((ind, i) => (
        <li key={i} className={`indicator-item severity-${ind.severity.toLowerCase()}`}>
          <span className="indicator-severity-dot" />
          <div className="indicator-body">
            <div className="indicator-header"><strong>{ind.type}</strong><code>{ind.value}</code></div>
            <p className="indicator-desc">{ind.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResultCard({ analysis }: { analysis: PhishingAnalysis }) {
  return (
    <div className="phishing-result">
      <div className="phishing-result-header">
        <RiskScoreGauge score={analysis.riskScore} level={analysis.riskLevel} />
        <div className="phishing-result-verdict">
          <h3>{analysis.verdict}</h3>
          <p className="text-muted">{new Date(analysis.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <section className="phishing-section">
        <h4>Executive Summary</h4>
        <p>{analysis.executiveSummary}</p>
      </section>

      <section className="phishing-section">
        <h4>Technical Summary</h4>
        <p>{analysis.technicalSummary}</p>
      </section>

      <section className="phishing-section">
        <h4>Indicators of Compromise</h4>
        <IndicatorList indicators={analysis.indicators} />
      </section>

      <section className="phishing-section">
        <h4>Recommended Actions</h4>
        <ul className="action-list">
          {analysis.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </section>

      <CitationBlock sources={analysis.sources} />

      <div className="phishing-result-actions">
        <ExportButton analysisId={analysis.id} format="pdf" label="Export PDF" icon="📄" />
        <ExportButton analysisId={analysis.id} format="docx" label="Export Word" icon="📝" />
        <CopyButton text={analysisToPlainText(analysis)} />
      </div>
    </div>
  );
}

export function PhishingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<InputTab>('email');
  const [emailContent, setEmailContent] = useState('');
  const [subject, setSubject] = useState('');
  const [url, setUrl] = useState('');
  const [senderDomain, setSenderDomain] = useState('');
  const [attachmentNamesRaw, setAttachmentNamesRaw] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PhishingAnalysis | null>(null);
  const [error, setError] = useState('');

  const [history, setHistory] = useState<PhishingAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    phishingApi.listAnalyses().then(d => setHistory(d.analyses)).catch(() => {}).finally(() => setHistoryLoading(false));
  }, []);

  function buildInput(): PhishingAnalysisInput {
    const attachmentNames = attachmentNamesRaw.split(',').map(s => s.trim()).filter(Boolean);
    return {
      emailContent: emailContent.trim() || undefined,
      subject: subject.trim() || undefined,
      url: url.trim() || undefined,
      senderDomain: senderDomain.trim() || undefined,
      attachmentNames: attachmentNames.length > 0 ? attachmentNames : undefined,
    };
  }

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    const input = buildInput();
    if (!input.emailContent && !input.url && !input.senderDomain && !input.subject) {
      setError('Provide at least one field to analyze.');
      return;
    }
    setAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const analysis = await phishingApi.analyze(input);
      setResult(analysis);
      setHistory(prev => [analysis, ...prev]);
    } catch (err: any) {
      setError(err?.message ?? 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  const sidebarContent = (
    <>
      <h3 className="sidebar-heading">Recent Analyses</h3>
      <div className="session-list">
        {historyLoading && [1, 2, 3].map(i => (
          <div key={i} className="skeleton skeleton-row" style={{ borderRadius: 8, margin: '0 0 4px' }} />
        ))}
        {!historyLoading && history.length === 0 && <p className="session-empty">No analyses yet.</p>}
        {history.map(a => (
          <button key={a.id} className="session-item-btn" onClick={() => setResult(a)}>
            <span className="session-title">{a.verdict.slice(0, 60)}{a.verdict.length > 60 ? '…' : ''}</span>
            <span className={`session-count risk-tag risk-tag-${a.riskLevel.toLowerCase()}`}>{a.riskLevel}</span>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <Layout sidebar={sidebarContent} userEmail={user?.email}>
      <main className="phishing-panel">
        <header className="panel-header">
          <div>
            <h1>AI Phishing Analyzer</h1>
            <p className="panel-subtitle">Paste an email, URL, or metadata below for a grounded risk analysis</p>
          </div>
        </header>

        <div className="phishing-tabs">
          {(['email', 'url', 'metadata'] as InputTab[]).map(t => (
            <button key={t} className={`phishing-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'email' ? 'Email' : t === 'url' ? 'URL' : 'Metadata'}
            </button>
          ))}
        </div>

        <form className="phishing-form" onSubmit={handleAnalyze}>
          {tab === 'email' && (
            <>
              <label>Subject line</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Urgent: Verify Your Account" />
              <label>Email content</label>
              <textarea value={emailContent} onChange={e => setEmailContent(e.target.value)} rows={8} placeholder="Paste the full email body here..." />
            </>
          )}
          {tab === 'url' && (
            <>
              <label>Suspicious URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://example-lookalike.com/login" />
            </>
          )}
          {tab === 'metadata' && (
            <>
              <label>Sender domain</label>
              <input value={senderDomain} onChange={e => setSenderDomain(e.target.value)} placeholder="suspicious-domain.com" />
              <label>Attachment names (comma-separated)</label>
              <input value={attachmentNamesRaw} onChange={e => setAttachmentNamesRaw(e.target.value)} placeholder="invoice.pdf.exe, statement.zip" />
            </>
          )}

          {error && <div className="chat-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={analyzing}>
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </form>

        {analyzing && <LoadingIndicator messages={ANALYSIS_LOADING_MESSAGES} />}

        {!analyzing && !result && (
          <div className="tool-empty">
            <div className="tool-empty-icon">🎣</div>
            <h3>No analysis yet</h3>
            <p>Paste a suspicious email, URL, or metadata above and CyberGuard AI will assess it for phishing risk, grounded in current OWASP and CISA guidance.</p>
          </div>
        )}

        {result && <ResultCard analysis={result} />}
      </main>
    </Layout>
  );
}
