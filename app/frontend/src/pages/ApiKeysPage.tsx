import React, { useEffect, useState } from 'react';
import { api, ApiKeyRecord, Connector } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

export const ApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [name, setName] = useState('');
  const [scopedConnectorId, setScopedConnectorId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Modal state for newly generated secret key
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [k, c] = await Promise.all([api.getKeys(), api.getConnectors()]);
      setKeys(k);
      setConnectors(c);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setCreating(true);
      const res = await api.createKey(name, scopedConnectorId || null);
      setCreatedSecret(res.secretKey);
      setName('');
      setScopedConnectorId('');
      loadData();
    } catch (err: any) {
      alert(`Failed to create API key: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, keyName: string) => {
    if (!window.confirm(`Are you sure you want to revoke API key '${keyName}'? External clients using this key will immediately be rejected.`)) {
      return;
    }
    try {
      await api.revokeKey(id);
      loadData();
    } catch (err: any) {
      alert(`Failed to revoke key: ${err.message}`);
    }
  };

  const handleCopySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          API Key Access Control
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Generate SHA-256 hashed API credentials for secure invocation of generated endpoints.
        </p>
      </div>

      {/* Create Key Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Generate New API Key</h3>
          <p className="card-subtitle">Keys are hashed with SHA-256 before storage; the secret key is only revealed once upon creation.</p>
        </div>

        <form onSubmit={handleCreateKey} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr auto', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Client or Application Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Mobile App Backend, Zapier Integration..."
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label">Scope Restriction</label>
            <select
              className="form-control"
              value={scopedConnectorId}
              onChange={e => setScopedConnectorId(e.target.value)}
            >
              <option value="">Universal Access (Any Connector)</option>
              {connectors.map(c => (
                <option key={c.id} value={c.id}>
                  Restricted to: {c.name}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={creating}>
            <Plus size={15} />
            <span>{creating ? 'Generating...' : 'Generate API Key'}</span>
          </button>
        </form>
      </div>

      {/* Secret Key Revealed Modal */}
      {createdSecret && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div className="card" style={{ maxWidth: '600px', width: '100%', margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-warning)', marginBottom: '12px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Save Your API Secret Key
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Please copy your API key now. For security purposes, it will <strong>never</strong> be displayed again or stored in plaintext.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-inset)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                marginBottom: '20px',
                gap: '10px',
              }}
            >
              <code style={{ fontSize: '0.88rem', color: 'var(--color-primary)', wordBreak: 'break-all', flex: 1 }}>
                {createdSecret}
              </code>
              <button className="btn btn-secondary btn-sm" onClick={handleCopySecret}>
                {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setCreatedSecret(null)}>
                I have saved this key safely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Registered API Keys ({keys.length})</h3>
        </div>

        {keys.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No API keys registered</div>
            <div className="empty-state-desc">Generate an API key above to authenticate requests to protected connectors.</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Key Name</th>
                  <th>Key Prefix</th>
                  <th>Scope</th>
                  <th>Created</th>
                  <th>Last Used</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => {
                  const scopedConn = connectors.find(c => c.id === k.connectorId);
                  return (
                    <tr key={k.id}>
                      <td>
                        <StatusBadge status={k.status} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{k.name}</td>
                      <td>
                        <code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{k.keyPrefix}</code>
                      </td>
                      <td>
                        {scopedConn ? (
                          <span className="badge badge-provider">Scoped: {scopedConn.name}</span>
                        ) : (
                          <span className="badge badge-active">Universal</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never used'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {k.status === 'active' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRevoke(k.id, k.name)}
                          >
                            <Trash2 size={13} />
                            <span>Revoke</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
