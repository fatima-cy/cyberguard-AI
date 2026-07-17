import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/auth.context';
import { organizationsApi } from '../api/organizations.api';
import { Layout } from '../components/Layout';
import type { Invitation } from '@cyberguard/shared';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export function TeamPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'org_admin' || user?.role === 'super_admin';

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'org_admin' | 'standard'>('standard');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    organizationsApi.listPendingInvitations()
      .then(d => setInvitations(d.invitations))
      .catch(() => setError('Failed to load invitations.'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    setInviting(true);
    try {
      const { invitation } = await organizationsApi.inviteTeammate({ email: email.trim(), role });
      setInvitations(prev => [invitation, ...prev]);
      setInviteSuccess(`Invitation sent to ${email.trim()}.`);
      setEmail('');
      setRole('standard');
    } catch (err: any) {
      setInviteError(err?.message ?? 'Failed to send invitation. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(id: string) {
    await organizationsApi.revokeInvitation(id);
    setInvitations(prev => prev.filter(inv => inv.id !== id));
  }

  if (!isAdmin) {
    return (
      <Layout userEmail={user?.email}>
        <main className="main-panel">
          <header className="panel-header">
            <div><h1>Team</h1></div>
          </header>
          <div className="tool-empty">
            <div className="tool-empty-icon">🔒</div>
            <h3>Admin access required</h3>
            <p>Only organisation admins can invite teammates or manage the team. Contact your admin if you need someone added.</p>
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
            <h1>Team</h1>
            <p className="panel-subtitle">Invite teammates and manage pending invitations</p>
          </div>
        </header>

        <div className="team-content">
          <div className="info-card team-invite-card">
            <h2>Invite a teammate</h2>
            <form className="phishing-form" onSubmit={handleInvite}>
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com" required />

              <label>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as 'org_admin' | 'standard')}>
                <option value="standard">Standard — full access to AI tools</option>
                <option value="org_admin">Admin — also manages team & org settings</option>
              </select>

              {inviteError && <div className="chat-error">{inviteError}</div>}
              {inviteSuccess && <div className="auth-success" style={{ marginTop: '0.5rem' }}>{inviteSuccess}</div>}

              <button type="submit" className="btn btn-primary" disabled={inviting}>
                {inviting ? 'Sending…' : 'Send invitation'}
              </button>
            </form>
          </div>

          <div className="info-card">
            <h2>Pending invitations</h2>
            {loading && <p className="text-muted">Loading…</p>}
            {error && <div className="chat-error">{error}</div>}
            {!loading && invitations.length === 0 && (
              <p className="text-muted">No pending invitations.</p>
            )}
            {invitations.length > 0 && (
              <ul className="invitation-list">
                {invitations.map(inv => (
                  <li key={inv.id} className="invitation-item">
                    <div>
                      <span className="invitation-email">{inv.invitedEmail}</span>
                      <span className="invitation-meta">{inv.role === 'org_admin' ? 'Admin' : 'Standard'} · sent {formatRelativeTime(inv.createdAt)}</span>
                    </div>
                    <button className="session-action-btn" onClick={() => handleRevoke(inv.id)} title="Revoke invitation">🗑️</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </Layout>
  );
}
