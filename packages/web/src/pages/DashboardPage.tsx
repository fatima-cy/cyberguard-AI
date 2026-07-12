import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth.context';
import { dashboardApi, chatApi, type DashboardSummary } from '../api/dashboard.api';
import { Layout } from '../components/Layout';
import type { ChatSession } from '@cyberguard/shared';

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <>
      <div className="stats-grid" style={{ padding: '1.5rem 2rem 0' }}>
        {[1,2,3,4].map(i => <div key={i} className="stat-card"><div className="skeleton skeleton-stat" /></div>)}
      </div>
      <div className="info-grid" style={{ padding: '1.25rem 2rem' }}>
        <div className="info-card">
          {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-row" />)}
        </div>
        <div className="info-card">
          {[1,2,3].map(i => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      </div>
    </>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([dashboardApi.getSummary(), chatApi.listSessions(1, 5)])
      .then(([s, d]) => { setSummary(s); setRecentSessions(d.sessions); })
      .catch(() => setError('Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  }

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

  const securityScore = summary ? calculateSecurityScore(summary) : 0;
  const firstName = summary?.user.name.split(' ')[0] ?? user?.name?.split(' ')[0] ?? '';

  return (
    <Layout userEmail={summary?.user.email ?? user?.email}>
      <main className="main-panel">
        <header className="panel-header">
          <div>
            <h1>Dashboard</h1>
            {firstName && <p className="panel-subtitle">Welcome back, {firstName}</p>}
          </div>
          <Link to="/chat" className="btn btn-primary">New conversation →</Link>
        </header>

        {loading && <DashboardSkeleton />}
        {error && <div className="panel-error" style={{ padding: '2rem' }}>{error}</div>}

        {summary && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{summary.stats.conversations}</div>
                <div className="stat-label">Conversations</div>
              </div>
              <div className="stat-card stat-card-score">
                <ScoreRing score={securityScore} />
                <div className="stat-score-info">
                  <div className="stat-value-sm" style={{ color: scoreColor(securityScore) }}>{scoreLabel(securityScore)}</div>
                  <div className="stat-label">Security Score</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.organization.memberCount}</div>
                <div className="stat-label">Team members</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatDate(summary.stats.lastActive)}</div>
                <div className="stat-label">Last active</div>
              </div>
            </div>

            <div className="info-grid">
              <div className="info-card">
                <h2>Organisation</h2>
                <div className="info-row"><span>Name</span><strong>{summary.organization.name}</strong></div>
                <div className="info-row"><span>Country</span><strong>{summary.organization.settings.country}</strong></div>
                <div className="info-row"><span>Industry</span><strong>{summary.organization.settings.industry}</strong></div>
                <div className="info-row"><span>Plan</span><strong className="plan-badge">{summary.organization.plan.toUpperCase()}</strong></div>
                <div className="info-row"><span>Role</span><strong>{summary.user.role.replace('_', ' ')}</strong></div>
              </div>
              <div className="info-card cta-card">
                <div className="cta-icon">💬</div>
                <h2>CyberGuard AI Assistant</h2>
                <p>Ask about NDPR compliance, threat analysis, security policies, and more — grounded in Nigerian and African cybersecurity frameworks.</p>
                <Link to="/chat" className="btn btn-primary">Start conversation →</Link>
              </div>
            </div>

            <div className="activity-section">
              <div className="activity-header">
                <h2>Recent Activity</h2>
                <Link to="/chat" className="activity-view-all">View all →</Link>
              </div>
              {recentSessions.length === 0 ? (
                <div className="activity-empty">
                  <p>No conversations yet. <Link to="/chat">Start your first one →</Link></p>
                </div>
              ) : (
                <div className="activity-list">
                  {recentSessions.map(session => (
                    <button key={session.id} className="activity-item" onClick={() => navigate(`/chat/${session.id}`)}>
                      <div className="activity-icon">💬</div>
                      <div className="activity-content">
                        <div className="activity-title">{session.title}</div>
                        <div className="activity-meta">{session.messageCount} messages · {formatRelativeTime(session.updatedAt)}</div>
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
