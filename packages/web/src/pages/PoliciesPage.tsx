import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/auth.context';
import { policiesApi } from '../api/dashboard.api';
import { Layout } from '../components/Layout';
import { PolicyViewer } from '../components/PolicyViewer';
import type { GeneratedPolicy, PolicyType, PolicySector } from '@cyberguard/shared';
import * as CyberguardShared from '@cyberguard/shared';

const POLICY_TYPE_LABELS = CyberguardShared.POLICY_TYPE_LABELS;
const POLICY_SECTOR_LABELS = CyberguardShared.POLICY_SECTOR_LABELS;

const POLICY_TYPES = Object.keys(POLICY_TYPE_LABELS) as PolicyType[];
const POLICY_SECTORS = Object.keys(POLICY_SECTOR_LABELS) as PolicySector[];

export function PoliciesPage() {
  const { user } = useAuth();
  const [type, setType] = useState<PolicyType>('data_protection');
  const [sector, setSector] = useState<PolicySector>('sme');
  const [organizationName, setOrganizationName] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedPolicy | null>(null);
  const [error, setError] = useState('');

  const [saved, setSaved] = useState<GeneratedPolicy[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  useEffect(() => {
    policiesApi.listPolicies().then(d => setSaved(d.policies)).catch(() => {}).finally(() => setSavedLoading(false));
  }, []);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!organizationName.trim()) {
      setError('Organization name is required.');
      return;
    }
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const policy = await policiesApi.generate(type, sector, {
        organizationName: organizationName.trim(),
        additionalContext: additionalContext.trim() || undefined,
      });
      setResult(policy);
      setSaved(prev => [policy, ...prev]);
    } catch (err: any) {
      setError(err?.message ?? 'Generation failed. This can take up to 60-90 seconds — please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    await policiesApi.deletePolicy(id);
    setSaved(prev => prev.filter(p => p.id !== id));
    if (result?.id === id) setResult(null);
  }

  const sidebarContent = (
    <>
      <h3 className="sidebar-heading">Saved Policies</h3>
      <div className="session-list">
        {savedLoading && [1, 2, 3].map(i => (
          <div key={i} className="skeleton skeleton-row" style={{ borderRadius: 8, margin: '0 0 4px' }} />
        ))}
        {!savedLoading && saved.length === 0 && <p className="session-empty">No policies generated yet.</p>}
        {saved.map(p => (
          <div key={p.id} className="session-item-wrapper">
            <button className="session-item-btn" onClick={() => setResult(p)}>
              <span className="session-title">{p.title}</span>
              <span className="session-count">{POLICY_SECTOR_LABELS[p.sector]}</span>
            </button>
            <div className="session-actions">
              <button className="session-action-btn" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} title="Delete">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <Layout sidebar={sidebarContent} userEmail={user?.email}>
      <main className="phishing-panel">
        <h2>Security Policy Generator</h2>
        <p className="text-muted">Generate a ready-to-adopt security policy grounded in current Nigerian and international standards.</p>

        <form className="phishing-form" onSubmit={handleGenerate}>
          <label>Policy Type</label>
          <select value={type} onChange={e => setType(e.target.value as PolicyType)}>
            {POLICY_TYPES.map(t => <option key={t} value={t}>{POLICY_TYPE_LABELS[t]}</option>)}
          </select>

          <label>Sector</label>
          <select value={sector} onChange={e => setSector(e.target.value as PolicySector)}>
            {POLICY_SECTORS.map(s => <option key={s} value={s}>{POLICY_SECTOR_LABELS[s]}</option>)}
          </select>

          <label>Organization Name</label>
          <input value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="e.g. Nile Store Ltd" />

          <label>Additional Context (optional)</label>
          <textarea value={additionalContext} onChange={e => setAdditionalContext(e.target.value)} rows={3} placeholder="e.g. We allow BYOD, we use AWS for hosting, we have 50 employees..." />

          {error && <div className="chat-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={generating}>
            {generating ? 'Generating… (can take up to 90s)' : 'Generate Policy'}
          </button>
        </form>

        {result && <PolicyViewer policy={result} />}
      </main>
    </Layout>
  );
}
