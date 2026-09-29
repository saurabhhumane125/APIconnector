import React, { useEffect, useState } from 'react';
import { api, ProviderSummary } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { Cpu, Key, Check, AlertCircle, Trash2, ExternalLink, ShieldCheck, RefreshCw } from 'lucide-react';

export const ProvidersPage: React.FC = () => {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputKeys, setInputKeys] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const list = await api.getProviders();
      setProviders(list);
    } catch (err) {
      console.error('Failed to load providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleKeyChange = (providerId: string, val: string) => {
    setInputKeys(prev => ({ ...prev, [providerId]: val }));
  };

  const handleSaveKey = async (providerId: string) => {
    const rawKey = inputKeys[providerId];
    if (!rawKey || !rawKey.trim()) {
      setMessage({ id: providerId, text: 'Please enter a valid API key string.', isError: true });
      return;
    }

    try {
      setSavingId(providerId);
      setMessage(null);
      await api.setProviderKey(providerId, rawKey.trim());
      setInputKeys(prev => ({ ...prev, [providerId]: '' }));
      setMessage({ id: providerId, text: `Successfully updated key for ${providerId.toUpperCase()}!` });
      await fetchProviders();
    } catch (err: any) {
      setMessage({ id: providerId, text: err.message || 'Failed to save key', isError: true });
    } finally {
      setSavingId(null);
    }
  };

  const handleRemoveKey = async (providerId: string) => {
    if (!window.confirm(`Are you sure you want to remove the API key for ${providerId.toUpperCase()}?`)) {
      return;
    }
    try {
      setSavingId(providerId);
      await api.removeProviderKey(providerId);
      setMessage({ id: providerId, text: `API key for ${providerId.toUpperCase()} removed.` });
      await fetchProviders();
    } catch (err: any) {
      setMessage({ id: providerId, text: err.message || 'Failed to remove key', isError: true });
    } finally {
      setSavingId(null);
    }
  };

  const getPortalInfo = (id: string) => {
    switch (id) {
      case 'gemini':
        return {
          portalUrl: 'https://aistudio.google.com/app/apikey',
          portalName: 'Google AI Studio',
          placeholder: 'Paste AQ.Ab8... or AIza... key',
          description: 'Free tier available with high rate limits. Supports multimodal images, text, and JSON schema.',
        };
      case 'groq':
        return {
          portalUrl: 'https://console.groq.com/keys',
          portalName: 'Groq Console',
          placeholder: 'Paste gsk_... key',
          description: 'Ultra-fast LPU inference for Llama 3.3 70B and 3.1 8B. Generous free tier.',
        };
      case 'openai':
        return {
          portalUrl: 'https://platform.openai.com/api-keys',
          portalName: 'OpenAI Platform',
          placeholder: 'Paste sk-... key',
          description: 'GPT-4o, GPT-4o-mini, and GPT-4-turbo with native JSON mode and vision.',
        };
      case 'anthropic':
        return {
          portalUrl: 'https://console.anthropic.com/settings/keys',
          portalName: 'Anthropic Console',
          placeholder: 'Paste sk-ant-... key',
          description: 'Claude 3.5 Sonnet and Haiku with deep reasoning and vision capabilities.',
        };
      default:
        return {
          portalUrl: '#',
          portalName: 'Provider Portal',
          placeholder: 'Paste API Key...',
          description: '',
        };
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            AI Provider Credentials
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Configure or override API keys for live AI execution. Keys are stored securely server-side and never exposed in full.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchProviders} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div style={{
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }}>
        <ShieldCheck size={20} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>High Availability & Key Pooling:</strong>
          {' '}You can supply <strong>multiple API keys</strong> per provider (separated by commas or newlines). The API Hub automatically balances traffic, rotates keys, and fails over across keys if any key encounters temporary capacity limits (HTTP 503) or rate limits (HTTP 429). Configuring multiple providers also enables <strong>automatic cross-provider failover</strong>.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {providers.map(prov => {
          const portal = getPortalInfo(prov.id);
          const isSaving = savingId === prov.id;
          const msg = message?.id === prov.id ? message : null;

          return (
            <div key={prov.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="card-header" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Cpu size={18} color="var(--color-primary)" />
                      <h3 className="card-title" style={{ margin: 0 }}>{prov.name}</h3>
                    </div>
                    <a
                      href={portal.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem',
                        color: 'var(--color-primary)',
                        textDecoration: 'none',
                        marginTop: '4px',
                      }}
                    >
                      <span>Get Free Key on {portal.portalName}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div>
                    {prov.isConfigured ? (
                      <span className="badge badge-active">
                        <Check size={11} /> Configured
                      </span>
                    ) : (
                      <span className="badge badge-disabled">
                        No Key
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  {portal.description}
                </p>

                {prov.isConfigured && prov.maskedKey && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--bg-inset)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '12px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Key:</span>
                    <code style={{ fontSize: '0.82rem', color: 'var(--color-success)' }}>{prov.maskedKey}</code>
                  </div>
                )}

                {msg && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '12px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: msg.isError ? 'var(--color-danger-subtle)' : 'var(--color-success-subtle)',
                      color: msg.isError ? 'var(--color-danger)' : 'var(--color-success)',
                      border: `1px solid ${msg.isError ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    }}
                  >
                    {msg.isError ? <AlertCircle size={14} /> : <Check size={14} />}
                    <span>{msg.text}</span>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    {prov.isConfigured ? 'Update API Key' : 'Enter API Key'}
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                    placeholder={portal.placeholder}
                    value={inputKeys[prov.id] || ''}
                    onChange={e => handleKeyChange(prov.id, e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                {prov.isConfigured ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemoveKey(prov.id)}
                    disabled={isSaving}
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                ) : <div />}

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSaveKey(prov.id)}
                  disabled={isSaving || !inputKeys[prov.id]}
                >
                  <Key size={13} />
                  <span>{isSaving ? 'Saving...' : 'Save Key'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
