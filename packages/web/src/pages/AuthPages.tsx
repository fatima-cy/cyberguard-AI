import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/auth.context';
import { ApiError } from '../api/client';
import { invitationsApi, type InvitationLookup } from '../api/organizations.api';

// ─── LoginPage ────────────────────────────────────────────────────────────────

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'success';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><img src="/cloudsecure-icon.png" alt="CloudSecure" className="auth-logo-mark" /> CyberGuard AI</div>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">AI-native cybersecurity for African enterprises</p>

        {resetSuccess && (
          <div className="auth-success">
            Password reset successfully. Sign in with your new password.
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" required autoFocus
            />
          </div>
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>
            <input
              id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}

// ─── RegisterPage ─────────────────────────────────────────────────────────────

type RegisterStep = 'account' | 'organization' | 'verify-pending';

export function RegisterPage() {
  const { register, createOrganization } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? undefined;

  const [step, setStep] = useState<RegisterStep>('account');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sprint 4.2.1 — invite lookup state
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null);
  const [invitationError, setInvitationError] = useState('');
  const [invitationLoading, setInvitationLoading] = useState(!!inviteToken);

  useEffect(() => {
    if (!inviteToken) return;
    invitationsApi.lookup(inviteToken)
      .then(data => {
        setInvitation(data);
        setEmail(data.invitedEmail); // pre-fill and effectively lock (input is disabled below)
      })
      .catch(() => setInvitationError('This invitation link is invalid or has expired.'))
      .finally(() => setInvitationLoading(false));
  }, [inviteToken]);

  async function handleAccountSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password, inviteToken);
      if (inviteToken) {
        // Invited registrations already have org + role assigned server-side
        // (see registerUser() in auth.service.ts) — skip the org-creation
        // step entirely and go straight in.
        navigate('/dashboard', { replace: true });
      } else {
        // Sprint 4.5.3 — standalone registrations now wait for email
        // verification before creating a workspace, instead of letting an
        // unverified account go straight into org creation and the
        // dashboard. Org creation still happens (via the dashboard's own
        // create-org prompt) once the user has verified and signed in.
        setStep('verify-pending');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOrgSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createOrganization(orgName);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create organisation.');
    } finally {
      setLoading(false);
    }
  }

  // Invalid/expired invite link — show a clear dead-end rather than letting
  // the form silently fall through to standalone registration with a
  // pre-filled email that no longer means anything.
  if (inviteToken && invitationError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo"><img src="/cloudsecure-icon.png" alt="CloudSecure" className="auth-logo-mark" /> CyberGuard AI</div>
          <h1 className="auth-title">Invitation not found</h1>
          <div className="auth-error">{invitationError}</div>
          <p className="auth-switch">
            <Link to="/register">Create a new account instead</Link> or <Link to="/login">sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><img src="/cloudsecure-icon.png" alt="CloudSecure" className="auth-logo-mark" /> CyberGuard AI</div>

        {step === 'verify-pending' ? (
          <>
            <h1 className="auth-title">Check your email</h1>
            <div className="auth-info">📧 A verification email has been sent to <strong>{email}</strong></div>
            <p className="auth-subtitle" style={{ marginTop: '1rem' }}>
              Verify your email, then sign in to create your organisation and get started.
            </p>
            <Link to="/login" className="btn btn-primary btn-full" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              Go to sign in →
            </Link>
          </>
        ) : step === 'account' ? (
          <>
            <h1 className="auth-title">Create account</h1>

            {inviteToken && invitationLoading && (
              <p className="auth-subtitle">Checking invitation…</p>
            )}
            {inviteToken && invitation && (
              <div className="auth-info">
                🎉 <strong>{invitation.invitedByName}</strong> invited you to join <strong>{invitation.organizationName}</strong> as a {invitation.role === 'org_admin' ? 'admin' : 'team member'}.
              </div>
            )}
            {!inviteToken && (
              <p className="auth-subtitle">Start securing your organisation today</p>
            )}

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleAccountSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="name">Full name</label>
                <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Fatima Umar" required autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required
                  disabled={!!inviteToken && !!invitation}
                  title={inviteToken && invitation ? 'This invitation is bound to this email address' : undefined}
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, 1 uppercase, 1 number" required />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading || invitationLoading}>
                {loading ? 'Creating account...' : inviteToken ? 'Join workspace →' : 'Continue'}
              </button>
            </form>

            <p className="auth-switch">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="auth-title">Create your organisation</h1>
            <p className="auth-subtitle">Your workspace for CyberGuard AI</p>
            <div className="auth-info">📧 A verification email has been sent to <strong>{email}</strong></div>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleOrgSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="orgName">Organisation name</label>
                <input id="orgName" type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="CloudSecure Solutions Ltd" required autoFocus />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Creating...' : 'Launch my workspace →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
