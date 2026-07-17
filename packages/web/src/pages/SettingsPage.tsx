import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/auth.context';
import { organizationsApi } from '../api/organizations.api';
import { Layout } from '../components/Layout';
import type { Organisation } from '@cyberguard/shared';

const COUNTRIES = [
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'KE', label: 'Kenya' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'EG', label: 'Egypt' },
  { value: 'other', label: 'Other' },
];

const INDUSTRIES = [
  { value: 'technology', label: 'Technology' },
  { value: 'fintech', label: 'Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'government', label: 'Government' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail / E-commerce' },
  { value: 'other', label: 'Other' },
];

const TIMEZONES = [
  { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
  { value: 'Africa/Accra', label: 'Accra (GMT)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
  { value: 'Africa/Cairo', label: 'Cairo (EET)' },
];

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'org_admin' || user?.role === 'super_admin';

  const [org, setOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [country, setCountry] = useState('NG');
  const [industry, setIndustry] = useState('technology');
  const [timezone, setTimezone] = useState('Africa/Lagos');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    organizationsApi.get()
      .then(d => {
        setOrg(d.organization);
        setName(d.organization.name);
        setCountry(d.organization.settings.country);
        setIndustry(d.organization.settings.industry);
        setTimezone(d.organization.settings.timezone);
      })
      .catch(() => setLoadError('Failed to load organisation settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);
    setSaving(true);
    try {
      const { organization } = await organizationsApi.update({ name: name.trim(), country, industry, timezone });
      setOrg(organization);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <Layout userEmail={user?.email}>
        <main className="main-panel">
          <header className="panel-header"><div><h1>Settings</h1></div></header>
          <div className="tool-empty">
            <div className="tool-empty-icon">🔒</div>
            <h3>Admin access required</h3>
            <p>Only organisation admins can view or change workspace settings.</p>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout userEmail={user?.email}>
      <main className="main-panel">
        <header className="panel-header">
          <div>
            <h1>Settings</h1>
            <p className="panel-subtitle">Organisation profile and preferences</p>
          </div>
        </header>

        {loading && <div className="info-card" style={{ margin: '0 2rem' }}><p className="text-muted">Loading…</p></div>}
        {loadError && <div className="chat-error" style={{ margin: '0 2rem' }}>{loadError}</div>}

        {!loading && !loadError && org && (
          <div className="info-card settings-card">
            <h2>Organisation Profile</h2>
            <form className="phishing-form" onSubmit={handleSubmit}>
              <label>Organisation Name</label>
              <input value={name} onChange={e => setName(e.target.value)} required />

              <label>Country</label>
              <select value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>

              <label>Industry</label>
              <select value={industry} onChange={e => setIndustry(e.target.value)}>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>

              <label>Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)}>
                {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              {saveError && <div className="chat-error">{saveError}</div>}
              {saveSuccess && <div className="auth-success" style={{ marginTop: '0.5rem' }}>Settings saved.</div>}

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            <div className="settings-meta">
              <div className="info-row"><span>Plan</span><strong className="plan-badge">{org.plan.toUpperCase()}</strong></div>
              <div className="info-row"><span>Members</span><strong>{org.memberCount}</strong></div>
              <div className="info-row"><span>Created</span><strong>{new Date(org.createdAt).toLocaleDateString()}</strong></div>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
