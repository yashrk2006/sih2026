import React, { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, AlertTriangle, RefreshCw, Lock } from 'lucide-react';
import { api } from '../services/api';
import type { AIProvider, AIProvidersResponse } from '../services/api';
import { PageHeader } from './ui/PageHeader';
import { LoadingState } from './ui/States';

const DEFAULT_PROVIDERS: AIProvider[] = [
  {
    id: 'local',
    name: 'Local Processing',
    installed: true,
    available: true,
    status_code: 'AVAILABLE',
    status_message: 'Regex + spaCy heuristics. Always active.',
  },
  {
    id: 'qwen',
    name: 'Qwen 3B',
    installed: true,
    available: false,
    status_code: 'INSTALLED_RESOURCE_LIMITED',
    status_message: 'Installed but resource-limited (insufficient memory / OOM).',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    installed: false,
    available: false,
    status_code: 'UNAVAILABLE',
    status_message: 'API key not configured.',
  },
];

function getProviderStatusBadge(p: AIProvider) {
  if (p.available) {
    return { text: 'Available', style: { background: 'var(--green-subtle)', color: 'var(--green-text)', border: '1px solid rgba(35,134,54,0.3)' } };
  }
  if (p.status_code?.includes('RESOURCE_LIMITED') || p.installed) {
    return { text: 'Resource Limited', style: { background: 'var(--amber-subtle)', color: 'var(--amber-text)', border: '1px solid rgba(158,106,3,0.3)' } };
  }
  return { text: 'Unavailable', style: { background: 'var(--surface-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' } };
}

export const AISettingsPanel: React.FC = () => {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('local');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get<AIProvidersResponse>('/ai/providers/');
      setProviders(res.data.providers || DEFAULT_PROVIDERS);
      setSelectedProvider(res.data.selected || 'local');
    } catch {
      setProviders(DEFAULT_PROVIDERS);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProvider = async (providerId: string) => {
    setMessage(null);
    setErrorMessage(null);
    setSelecting(providerId);
    try {
      const res = await api.post('/ai/providers/select/', { provider: providerId });
      setSelectedProvider(res.data.selected || providerId);
      setMessage(`Provider updated to: ${res.data.selected || providerId}`);
    } catch (err: any) {
      const errText =
        err.response?.data?.error ??
        `Cannot activate ${providerId} — provider is currently unavailable.`;
      setErrorMessage(errText);
      fetchProviders();
    } finally {
      setSelecting(null);
    }
  };

  const displayProviders = providers.length > 0 ? providers : DEFAULT_PROVIDERS;

  return (
    <div>
      <PageHeader
        title="AI Processing"
        description="Configure optional document extraction models. Local processing is always the baseline and handles sensitive documents by default."
        action={
          <button className="btn btn-ghost btn-sm" onClick={fetchProviders}>
            <RefreshCw size={13} />
            Re-probe
          </button>
        }
      />

      {/* Alerts */}
      {message && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 0.875rem',
            background: 'var(--green-subtle)',
            border: '1px solid rgba(35,134,54,0.3)',
            borderRadius: 'var(--radius)',
            color: 'var(--green-text)', fontSize: '0.8125rem',
            marginBottom: '1rem',
          }}
        >
          <CheckCircle2 size={14} />
          {message}
        </div>
      )}
      {errorMessage && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 0.875rem',
            background: 'var(--amber-subtle)',
            border: '1px solid rgba(158,106,3,0.3)',
            borderRadius: 'var(--radius)',
            color: 'var(--amber-text)', fontSize: '0.8125rem',
            marginBottom: '1rem',
          }}
        >
          <AlertTriangle size={14} />
          {errorMessage}
        </div>
      )}

      {loading ? (
        <LoadingState rows={3} message="Probing AI providers…" />
      ) : (
        <>
          {/* Provider cards — stacked, mobile-first */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {displayProviders.map((p) => {
              const isSelected = selectedProvider === p.id;
              const badge = getProviderStatusBadge(p);
              const canSelect = p.available && !isSelected;

              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: '1rem',
                    borderColor: isSelected ? 'var(--accent-border)' : undefined,
                    background: isSelected ? 'var(--accent-subtle)' : undefined,
                    transition: 'border-color 0.1s, background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: 'var(--radius)',
                          background: isSelected ? 'var(--accent)' : 'var(--surface-raised)',
                          border: `1px solid ${isSelected ? 'var(--accent-border)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Cpu size={16} style={{ color: isSelected ? '#fff' : 'var(--text-muted)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {p.name}
                          </span>
                          {isSelected && (
                            <span
                              style={{
                                fontSize: '0.625rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                                padding: '0.125rem 0.5rem', borderRadius: '3px',
                                background: 'var(--accent)', color: '#fff',
                              }}
                            >
                              SELECTED
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '0.6875rem', fontWeight: 600,
                              padding: '0.125rem 0.5rem', borderRadius: '4px',
                              fontFamily: 'JetBrains Mono, monospace',
                              ...badge.style,
                            }}
                          >
                            {badge.text}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                          {p.status_message}
                        </p>
                        {p.id === 'local' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <Lock size={11} style={{ color: 'var(--green-text)' }} />
                            Processes locally — no external data transmission
                          </div>
                        )}
                        {!p.available && p.id !== 'local' && (
                          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-disabled)' }}>
                            {p.id === 'qwen'
                              ? 'Qwen 3B is not available on this system.'
                              : 'External AI provider — requires API key configuration.'}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className={`btn btn-sm ${canSelect ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => handleSelectProvider(p.id)}
                      disabled={isSelected || !canSelect || selecting === p.id}
                      style={{ flexShrink: 0 }}
                    >
                      {selecting === p.id ? (
                        <div style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent-hover)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      ) : isSelected ? (
                        <><CheckCircle2 size={12} /> Active</>
                      ) : canSelect ? (
                        'Select'
                      ) : (
                        'Unavailable'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Privacy notice */}
          <div
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
              padding: '0.875rem 1rem',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
            }}
          >
            <Lock size={14} style={{ color: 'var(--green-text)', flexShrink: 0, marginTop: '0.0625rem' }} />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Privacy by Default
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                Sensitive documents are processed locally by default using regex and heuristic extraction.
                External AI providers (Qwen, Gemini) are used only when explicitly selected by an administrator.
                No document content is transmitted to external services unless the administrator has enabled and selected
                an external provider.
              </p>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
