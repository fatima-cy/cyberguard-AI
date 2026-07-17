import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/auth.context';
import { organizationsApi } from '../api/organizations.api';
import { Layout } from '../components/Layout';
import type { Invitation, User, AuditEvent, AuditAction } from '@cyberguard/shared';

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

const AUDIT_ICON: Record<AuditAction, string> = {
  'organization.updated': '⚙️',
  'invitation.sent': '✉️',
  'invitation.revoked': '🚫',
  'member.role_changed': '🔄',
  'member.removed': '👋',
  'policy.generated': '📄',
  'phishing.analyzed': '🎣',
};

function MemberList({ members, currentUserId, isAdmin, onRoleChange, onRemove }: {
  members: User[];
  currentUserId: string | undefined;
  isAdmin: boolean;
  onRoleChange: (userId: string, role: 'org_admin' | 'standard') => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  async function handleRoleChange(userId: string, role: 'org_admin' | 'standard') {
    setError('');
    setPendingId(userId);
    try {
      await onRoleChange(userId, role);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to change role.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(userId: string) {
    if (confirmingRemoveId !== userId) { setConfirmingRemoveId(userId); return; }
    setError('');
    setPendingId(userId);
    try {
      await onRemove(userId);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to remove member.');
    } finally {
      setPendingId(null);
      setConfirmingRemoveId(null);
    }
  }

  return (
    <div className="info-card">
      <h2>Members ({members.length})</h2>
      {error && <div className="chat-error">{error}</div>}
      <ul className="invitation-list">
        {members.map(m => (
          <li key={m.id} className="invitation-item">
            <div>
              <span className="invitation-email">{m.name} {m.id === currentUserId && <span className="text-muted">(you)</span>}</span>
              <span className="invitation-meta">{m.email}</span>
            </div>
            {isAdmin ? (
              <div className="member-actions">
                <select
                  value={m.role === 'super_admin' ? 'org_admin' : m.role}
                  onChange={e => handleRoleChange(m.id, e.target.value as 'org_admin' | 'standard')}
                  disabled={pendingId === m.id || m.id === currentUserId || m.role === 'super_admin'}
                  title={m.id === currentUserId ? "You can't change your own role" : undefined}
                >
                  <option value="standard">Standard</option>
                  <option value="org_admin">Admin</option>
                </select>
                <button
                  className={`session-action-btn ${confirmingRemoveId === m.id ? 'danger' : ''}`}
                  onClick={() => handleRemove(m.id)}
                  disabled={pendingId === m.id || m.id === currentUserId}
                  title={m.id === currentUserId ? "You can't remove yourself" : confirmingRemoveId === m.id ? 'Confirm removal' : 'Remove member'}
                >
                  {confirmingRemoveId === m.id ? '⚠️' : '🗑️'}
                </button>
              </div>
            ) : (
              <span className="invitation-meta">{m.role === 'org_admin' ? 'Admin' : m.role === 'super_admin' ? 'Super Admin' : 'Standard'}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuditLogFeed({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return <p className="text-muted">No activity recorded yet.</p>;
  }
  return (
    <div className="activity-list">
      {events.map(ev => (
        <div key={ev.id} className="activity-item audit-item">
          <div className="activity-icon">{AUDIT_ICON[ev.action] ?? '•'}</div>
          <div className="activity-content">
            <div className="activity-title">{ev.summary}</div>
            <div className="activity-meta">{ev.userName} · {formatRelativeTime(ev.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TeamPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'org_admin' || user?.role === 'super_admin';

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'org_admin' | 'standard'>('standard');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    const calls: Promise<any>[] = [organizationsApi.listMembers().then(d => setMembers(d.members))];
    if (isAdmin) {
      calls.push(organizationsApi.listPendingInvitations().then(d => setInvitations(d.invitations)));
      calls.push(organizationsApi.listAuditLog().then(d => setAuditEvents(d.events)));
    }
    Promise.all(calls)
      .catch(() => setError('Failed to load team data.'))
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
      organizationsApi.listAuditLog().then(d => setAuditEvents(d.events)).catch(() => {});
    } catch (err: any) {
      setInviteError(err?.message ?? 'Failed to send invitation. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(id: string) {
    await organizationsApi.revokeInvitation(id);
    setInvitations(prev => prev.filter(inv => inv.id !== id));
    organizationsApi.listAuditLog().then(d => setAuditEvents(d.events)).catch(() => {});
  }

  async function handleRoleChange(userId: string, newRole: 'org_admin' | 'standard') {
    await organizationsApi.changeMemberRole(userId, newRole);
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m));
    organizationsApi.listAuditLog().then(d => setAuditEvents(d.events)).catch(() => {});
  }

  async function handleRemoveMember(userId: string) {
    await organizationsApi.removeMember(userId);
    setMembers(prev => prev.filter(m => m.id !== userId));
    organizationsApi.listAuditLog().then(d => setAuditEvents(d.events)).catch(() => {});
  }

  return (
    <Layout userEmail={user?.email}>
      <main className="main-panel">
        <header className="panel-header">
          <div>
            <h1>Team</h1>
            <p className="panel-subtitle">{isAdmin ? 'Invite teammates and manage your team' : 'See who has access to this workspace'}</p>
          </div>
        </header>

        <div className="team-content">
          {isAdmin ? (
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

              {invitations.length > 0 && (
                <>
                  <h2 style={{ marginTop: '1.5rem' }}>Pending invitations</h2>
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
                </>
              )}
            </div>
          ) : (
            <div className="info-card">
              <h2>Invitations</h2>
              <p className="text-muted">Only admins can invite teammates. Contact your admin if you need someone added.</p>
            </div>
          )}

          {loading && <div className="info-card"><p className="text-muted">Loading…</p></div>}
          {error && <div className="chat-error">{error}</div>}
          {!loading && (
            <MemberList members={members} currentUserId={user?.id} isAdmin={isAdmin} onRoleChange={handleRoleChange} onRemove={handleRemoveMember} />
          )}
        </div>

        {isAdmin && !loading && (
          <div className="info-card audit-log-card">
            <h2>Activity Log</h2>
            <AuditLogFeed events={auditEvents} />
          </div>
        )}
      </main>
    </Layout>
  );
}
