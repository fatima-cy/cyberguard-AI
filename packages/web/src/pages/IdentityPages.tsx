import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';

// ─── ForgotPasswordPage ───────────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/v1/auth/forgot-password', { email });
    } catch { /* always show success */ }
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo"><img src="/cloudsecure-icon.png" alt="CloudSecure" className="auth-logo-mark" /> CyberGuard AI</div>
          <div className="auth-success-icon">✉️</div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle">
            If an account exists for <strong>{email}</strong>, we've sent a password reset link. Check your inbox and spam folder.
          </p>
          <p className="auth-switch" style={{ marginTop: '1.5rem' }}>
            <Link to="/login">← Back to sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><img src="/cloudsecure-icon.png" alt="CloudSecure" className="auth-logo-mark" /> CyberGuard AI</div>
        <h1 className="auth-title">Forgot password?</h1>
        <p className="auth-subtitle">Enter your email and we'll send you a reset link.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

// ─── ResetPasswordPage ────────────────────────────────────────────────────────

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setError('');
    setLoading(true);
    try {
      await api.post('/api/v1/auth/reset-password', { token, password });
      navigate('/login?reset=success', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><img src="/cloudsecure-icon.png" alt="CloudSecure" className="auth-logo-mark" /> CyberGuard AI</div>
        <h1 className="auth-title">Set new password</h1>
        <p className="auth-subtitle">Choose a strong password for your account.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Saving...' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── VerifyEmailPage ──────────────────────────────────────────────────────────

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  // Sprint 4.5.3 — deliberately does NOT auto-fire on mount. Email
  // link-scanners (Gmail's security scanning, Safari Link Preview,
  // corporate mail proxies) pre-visit URLs found in emails before the
  // recipient ever sees them — if verification fired automatically on
  // page load, that scan alone would silently consume the one-time token,
  // so every real click by the actual user would then fail with "invalid
  // or expired" even on a token that's genuinely fresh. Requiring an
  // explicit click means only real human interaction consumes it —
  // scanners load the page but don't click buttons.
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>(token ? 'idle' : 'error');

  function handleVerify() {
    setStatus('verifying');
    api.post('/api/v1/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo"><img src="/cloudsecure-icon.png" alt="CloudSecure" className="auth-logo-mark" /> CyberGuard AI</div>

        {status === 'idle' && (
          <>
            <h1 className="auth-title">Verify your email</h1>
            <p className="auth-subtitle">Click below to confirm your email address and activate your account.</p>
            <button className="btn btn-primary btn-full" style={{ marginTop: '1.5rem' }} onClick={handleVerify}>
              Verify email address
            </button>
          </>
        )}

        {status === 'verifying' && (
          <>
            <div className="loading-spinner" style={{ margin: '1.5rem auto' }} />
            <p className="auth-subtitle">Verifying your email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', margin: '1rem 0' }}>✅</div>
            <h1 className="auth-title">Email verified!</h1>
            {/* Sprint 4.5.3 — this page is usually opened from an email
                link, which is a fresh browser tab with no access token in
                memory (tokens are deliberately never persisted to storage).
                Sending straight to /dashboard here would hit the API with
                no auth at all, so this sends to /login instead — a real
                signed-in session, not just a client-side route change. */}
            <p className="auth-subtitle">Your email address has been confirmed. Sign in to continue.</p>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: '1.5rem' }}
              onClick={() => navigate('/login', { replace: true })}
            >
              Sign in →
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', margin: '1rem 0' }}>❌</div>
            <h1 className="auth-title">Verification failed</h1>
            <p className="auth-subtitle">This verification link is invalid or has expired.</p>
            <p className="auth-switch" style={{ marginTop: '1.5rem' }}>
              <Link to="/login">Sign in to resend verification →</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
