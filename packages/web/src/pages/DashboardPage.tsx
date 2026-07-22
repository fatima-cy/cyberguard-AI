import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../context/auth.context';
import { dashboardApi, type DashboardSummary, type ActivityItem } from '../api/dashboard.api';
import { organizationsApi } from '../api/organizations.api';
import { ApiError } from '../api/client';
import { Layout } from '../components/Layout';

// ─── Security Score ───────────────────────────────────────────────────────────

function calculateSecurityScore(summary: DashboardSummary): number {
  let score = 30;
  if (summary.stats.conversations >= 1) score += 20;
  if (summary.organization.settings.country && summary.organization.settings.industry !== 'other') score += 15;
  if (['fintech', 'healthcare', 'government'].includes(summary.organization.settings.industry)) score += 10;
  if (['professional', 'enterprise'].includes(summary.organization.plan)) score += 15;
  if (summary.organization.memberCount > 1) score += 10;
  return Math.min(score, 100);
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return '#f59e0b';
  return 'var(--danger)';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Attention';
}

function ScoreRing({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = scoreColor(score);
  return (
    <div className="score-ring-wrapper">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${progress} ${circumference}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="score-ring-value" style={{ color }}>{score}</div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const RISK_COLORS = { LOW: '#22c55e', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' };

function RiskDistributionChart({ riskBreakdown }: { riskBreakdown: DashboardSummary['stats']['riskBreakdown'] }) {
  const data = (Object.keys(RISK_COLORS) as (keyof typeof RISK_COLORS)[])
    .map(level => ({ name: level, value: riskBreakdown[level] }))
    .filter(d => d.value > 0);

  if (data.length === 0) {
    return <p className="chart-empty">No phishing analyses yet — results will appear here.</p>;
  }

  return (
    <div className="chart-with-legend">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={3}>
            {data.map((d) => <Cell key={d.name} fill={RISK_COLORS[d.name as keyof typeof RISK_COLORS]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="chart-legend">
        {data.map(d => (
          <li key={d.name}>
            <span className="chart-legend-dot" style={{ background: RISK_COLORS[d.name as keyof typeof RISK_COLORS] }} />
            {d.name} <strong>{d.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModuleActivityChart({ summary }: { summary: DashboardSummary }) {
  const data = [
    { name: 'Chats', value: summary.stats.conversations, fill: 'var(--primary)' },
    { name: 'Analyses', value: summary.stats.phishingAnalyses, fill: '#f97316' },
    { name: 'Policies', value: summary.stats.policiesGenerated, fill: '#22c55e' },
  ];
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={70} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'var(--bg)' }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<ActivityItem['type'], string> = { chat: '💬', phishing: '🎣', policy: '📄' };

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <>
      <div className="stats-grid" style={{ padding: '1.5rem 2rem 0' }}>
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="stat-card"><div className="skeleton skeleton-stat" /></div>)}
      </div>
      <div className="info-grid" style={{ padding: '1.25rem 2rem' }}>
        <div className="info-card">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-row" />)}</div>
        <div className="info-card">{[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-row" />)}</div>
      </div>
    </>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Sprint 4.5.3 — standalone signups reach the dashboard with no
  // organisation yet (organizationId: null); the backend correctly 403s
  // dashboard/summary in that case rather than silently degrading, so the
  // frontend needs to catch that specific case and offer to create one
  // inline instead of showing a bare "Failed to load dashboard." error.
  const [needsOrg, setNeedsOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgSubmitting, setOrgSubmitting] = useState(false);
  const [orgError, setOrgError] = useState('');

  function loadSummary() {
    setLoading(true);
    setError('');
    dashboardApi.getSummary()
      .then(summary => { setSummary(summary); setNeedsOrg(false); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 403) {
          setNeedsOrg(true);
        } else {
          setError('Failed to load dashboard.');
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSummary(); }, []);

  function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setOrgSubmitting(true);
    setOrgError('');
    organizationsApi.create({ name: orgName })
      .then(() => loadSummary())
      .catch(() => setOrgError('Could not create your organisation. Please try again.'))
      .finally(() => setOrgSubmitting(false));
  }

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const securityScore = summary ? calculateSecurityScore(summary) : 0;
  const firstName = summary?.user.name.split(' ')[0] ?? user?.name?.split(' ')[0] ?? '';

  return (
    <Layout userEmail={summary?.user.email ?? user?.email} orgName={summary?.organization.name}>
      <main className="main-panel">
        <header className="panel-header">
          <div>
            <h1>Security Operations Dashboard</h1>
            {firstName && <p className="panel-subtitle">Welcome back, {firstName}</p>}
          </div>
          <Link to="/chat" className="btn btn-primary">New conversation →</Link>
        </header>

        {loading && <DashboardSkeleton />}
        {error && <div className="panel-error" style={{ padding: '2rem' }}>{error}</div>}

        {needsOrg && (
          <div className="info-card" style={{ margin: '2rem', maxWidth: 420 }}>
            <h2>Create your organisation</h2>
            <p className="chart-card-subtitle">You need an organisation before you can use CyberGuard AI. This only takes a moment.</p>
            <form onSubmit={handleCreateOrg} style={{ marginTop: '1rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Organisation name"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                minLength={2}
                maxLength={100}
                required
                style={{ width: '100%', marginBottom: '1rem' }}
              />
              {orgError && <p className="panel-error" style={{ marginBottom: '1rem' }}>{orgError}</p>}
              <button type="submit" className="btn btn-primary btn-full" disabled={orgSubmitting}>
                {orgSubmitting ? 'Creating…' : 'Create organisation'}
              </button>
            </form>
          </div>
        )}

        {summary && (
          <>
            <div className="stats-grid">
              <div className="stat-card stat-card-score">
                <ScoreRing score={securityScore} />
                <div className="stat-score-info">
                  <div className="stat-value-sm" style={{ color: scoreColor(securityScore) }}>{scoreLabel(securityScore)}</div>
                  <div className="stat-label">Security Score</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.stats.conversations}</div>
                <div className="stat-label">Conversations</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.stats.phishingAnalyses}</div>
                <div className="stat-label">Phishing Analyses</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.stats.policiesGenerated}</div>
                <div className="stat-label">Policies Generated</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatDate(summary.stats.lastActive)}</div>
                <div className="stat-label">Last active</div>
              </div>
            </div>

            <div className="chart-grid">
              <div className="info-card chart-card">
                <h2>Risk Distribution</h2>
                <p className="chart-card-subtitle">Across all phishing analyses</p>
                <RiskDistributionChart riskBreakdown={summary.stats.riskBreakdown} />
              </div>
              <div className="info-card chart-card">
                <h2>Module Activity</h2>
                <p className="chart-card-subtitle">Usage across CyberGuard AI</p>
                <ModuleActivityChart summary={summary} />
              </div>
              <div className="info-card cta-card">
                <div className="cta-icon">💬</div>
                <h2>CyberGuard AI Assistant</h2>
                <p>Ask about NDPA/GAID compliance, threat analysis, and security policies — grounded in current Nigerian and international frameworks.</p>
                <Link to="/chat" className="btn btn-primary">Start conversation →</Link>
              </div>
            </div>

            <div className="activity-section">
              <div className="activity-header">
                <h2>Recent Activity</h2>
              </div>
              {summary.recentActivity.length === 0 ? (
                <div className="activity-empty">
                  <p>No activity yet. <Link to="/chat">Start your first conversation →</Link></p>
                </div>
              ) : (
                <div className="activity-list">
                  {summary.recentActivity.map(item => (
                    <button key={`${item.type}-${item.id}`} className="activity-item" onClick={() => navigate(item.href)}>
                      <div className="activity-icon">{ACTIVITY_ICON[item.type]}</div>
                      <div className="activity-content">
                        <div className="activity-title">{item.title}</div>
                        <div className="activity-meta">{item.meta} · {formatRelativeTime(item.timestamp)}</div>
                      </div>
                      <div className="activity-arrow">→</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </Layout>
  );
}
