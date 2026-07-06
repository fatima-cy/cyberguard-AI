import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth.context';
import { dashboardApi, type DashboardSummary } from '../api/dashboard.api';

export function DashboardPage() {
  const { logout } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.getSummary()
      .then(setSummary)
      .catch(() => setError('Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-logo">🛡️ CyberGuard AI</div>
        <ul className="sidebar-nav">
          <li className="active"><Link to="/dashboard">Dashboard</Link></li>
          <li><Link to="/chat">AI Assistant</Link></li>
        </ul>
        <div className="sidebar-footer">
          <span className="sidebar-user">{summary?.user.email ?? '...'}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <main className="main-panel">
        <header className="panel-header">
          <h1>Dashboard</h1>
          <Link to="/chat" className="btn btn-primary">New conversation →</Link>
        </header>

        {loading && <div className="panel-loading">Loading...</div>}
        {error && <div className="panel-error">{error}</div>}

        {summary && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{summary.stats.conversations}</div>
                <div className="stat-label">Conversations</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.organization.plan.toUpperCase()}</div>
                <div className="stat-label">Plan</div>
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
                <div className="info-row">
                  <span>Name</span>
                  <strong>{summary.organization.name}</strong>
                </div>
                <div className="info-row">
                  <span>Country</span>
                  <strong>{summary.organization.settings.country}</strong>
                </div>
                <div className="info-row">
                  <span>Industry</span>
                  <strong>{summary.organization.settings.industry}</strong>
                </div>
                <div className="info-row">
                  <span>Role</span>
                  <strong>{summary.user.role.replace('_', ' ')}</strong>
                </div>
              </div>

              <div className="info-card cta-card">
                <div className="cta-icon">💬</div>
                <h2>CyberGuard AI Assistant</h2>
                <p>Ask about NDPR compliance, threat analysis, security policies, and more — grounded in Nigerian and African cybersecurity frameworks.</p>
                <Link to="/chat" className="btn btn-primary">Start conversation →</Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
