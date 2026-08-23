import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { api, setAuthTokens } from '../services/api';
import type { UserRole } from '../services/api';

interface LoginModalProps {
  onLoginSuccess: (user: UserRole) => void;
}

const demoAccounts = [
  { username: 'admin', role: 'ADMIN' as const, label: 'System Administrator', desc: 'Full access' },
  { username: 'investigator1', role: 'INVESTIGATOR' as const, label: 'Investigator', desc: 'Cases & evidence' },
  { username: 'legal1', role: 'LEGAL_OFFICER' as const, label: 'Legal Officer', desc: 'Sign & review' },
  { username: 'auditor1', role: 'AUDITOR' as const, label: 'Auditor', desc: 'Audit & blockchain' },
  { username: 'demo_viewer', role: 'VIEWER' as const, label: 'Viewer', desc: 'Read only' },
];

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('SecurePass123!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  const handleLoginWithCredentials = async (uname: string, pass: string) => {
    setLoading(true);
    setError(null);

    try {
      const tokenRes = await api.post('/auth/token/', { username: uname, password: pass });
      const { access, refresh } = tokenRes.data;
      setAuthTokens(access, refresh);

      try {
        const meRes = await api.get('/users/me/');
        onLoginSuccess({
          username: meRes.data.username || uname,
          role: meRes.data.role || 'ADMIN',
          email: meRes.data.email || `${uname}@sih26190.local`,
        });
      } catch {
        const matched = demoAccounts.find((a) => a.username === uname);
        onLoginSuccess({
          username: uname,
          role: matched ? matched.role : 'ADMIN',
          email: `${uname}@sih26190.local`,
        });
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) setError('Invalid username or password.');
      else if (status === 400) setError(err.response?.data?.detail || 'Invalid login parameters.');
      else if (status === 500) setError('Server error. Check the backend service.');
      else if (status === 502 || status === 503 || !err.response)
        setError('Authentication service unreachable. Start the Django backend.');
      else setError(err.response?.data?.detail || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLoginWithCredentials(username, password);
  };

  const handleQuickSelect = (acc: typeof demoAccounts[0]) => {
    setUsername(acc.username);
    setPassword('SecurePass123!');
    handleLoginWithCredentials(acc.username, 'SecurePass123!');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
    >
      {/* Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '400px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        {/* Header strip */}
        <div
          style={{
            padding: '1.5rem 1.5rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 44, height: 44,
              borderRadius: '10px',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 0.875rem',
            }}
          >
            <Shield size={20} style={{ color: 'var(--accent-hover)' }} />
          </div>
          <h1
            style={{
              fontSize: '1.0625rem', fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em', margin: 0, marginBottom: '0.25rem',
            }}
          >
            SIH26190 Secure Console
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Digital Evidence Management System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem' }}>
          {/* Username */}
          <div style={{ marginBottom: '0.875rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.375rem' }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={13}
                style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
              />
              <input
                id="login-username"
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                style={{ paddingLeft: '2rem' }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="text-label" style={{ display: 'block', marginBottom: '0.375rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={13}
                style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingLeft: '2rem', paddingRight: '2.25rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                style={{
                  position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '0.125rem', display: 'flex',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '0.625rem 0.75rem',
                background: 'var(--red-subtle)',
                border: '1px solid rgba(218,54,51,0.3)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--red-text)',
                fontSize: '0.8125rem',
                marginBottom: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: 13, height: 13,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
                Authenticating…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Demo accounts */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0 1.5rem 1.25rem' }}>
          <button
            onClick={() => setShowDemo((p) => !p)}
            style={{
              width: '100%', textAlign: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--text-muted)',
              padding: '0.75rem 0 0.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}
          >
            Demo Accounts
            <ArrowRight size={11} style={{ transform: showDemo ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {showDemo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.username}
                  onClick={() => handleQuickSelect(acc)}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {acc.label}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {acc.desc}
                    </div>
                  </div>
                  <ArrowRight size={12} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Secure system footer */}
        <div
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--surface-raised)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            justifyContent: 'center',
          }}
        >
          <ShieldCheck size={11} style={{ color: 'var(--green-text)' }} />
          <span style={{ fontSize: '0.625rem', color: 'var(--text-disabled)', fontFamily: 'JetBrains Mono, monospace' }}>
            SECURE SYSTEM · JWT AUTH · TLS ENCRYPTED
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
