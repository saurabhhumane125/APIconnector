import React, { useEffect, useState } from 'react';
import { api, Connector } from '../lib/api';
import { CodeBlock } from '../components/CodeBlock';
import { StatusBadge } from '../components/StatusBadge';
import { BookOpen, Copy, Check, Terminal, ExternalLink, ShieldAlert } from 'lucide-react';

interface DocumentationPageProps {
  initialConnectorId?: string;
}

export const DocumentationPage: React.FC<DocumentationPageProps> = ({ initialConnectorId }) => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>(initialConnectorId || '');
  const [docs, setDocs] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getConnectors().then(list => {
      setConnectors(list);
      if (!selectedConnectorId && list.length > 0) {
        setSelectedConnectorId(list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedConnectorId) return;
    setLoading(true);
    api.getConnectorDocs(selectedConnectorId)
      .then(d => setDocs(d))
      .catch(err => console.error('Failed to load documentation:', err))
      .finally(() => setLoading(false));
  }, [selectedConnectorId]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Generated API Documentation
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Real-time interactive documentation generated directly from authoritative connector database schemas.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="form-label" style={{ margin: 0 }}>Connector:</label>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '260px' }}
            value={selectedConnectorId}
            onChange={e => setSelectedConnectorId(e.target.value)}
          >
            {connectors.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.provider})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !docs ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading API documentation...</p>
        </div>
      ) : (
        <div>
          {/* Header Overview Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {docs.name}
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {docs.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <StatusBadge status={docs.status} />
                <span className="badge badge-provider">{docs.provider} / {docs.model}</span>
                <span className="badge badge-auth">Auth: {docs.authType}</span>
              </div>
            </div>

            {/* Endpoint Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'var(--bg-inset)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                marginTop: '16px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {docs.httpMethod}
              </span>
              <code style={{ fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1 }}>
                {docs.endpointUrl}
              </code>
            </div>
          </div>

          {/* Authentication & Headers */}
          <div className="card">
            <h3 className="card-title">Request Headers & Authentication</h3>
            <p className="card-subtitle">Required HTTP headers when invoking this endpoint.</p>

            <div className="table-container" style={{ marginTop: '12px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Header</th>
                    <th>Value / Description</th>
                    <th>Required</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>Content-Type</code></td>
                    <td><code>application/json</code></td>
                    <td><span className="badge badge-active">Required</span></td>
                  </tr>
                  {docs.authType === 'api_key' && (
                    <tr>
                      <td><code>X-API-Key</code></td>
                      <td><code>hub_live_YOUR_KEY</code></td>
                      <td><span className="badge badge-active">Required</span></td>
                    </tr>
                  )}
                  {docs.authType === 'bearer_token' && (
                    <tr>
                      <td><code>Authorization</code></td>
                      <td><code>Bearer hub_live_YOUR_KEY</code></td>
                      <td><span className="badge badge-active">Required</span></td>
                    </tr>
                  )}
                  {docs.authType === 'none' && (
                    <tr>
                      <td><code>Authorization</code></td>
                      <td>None required (Public endpoint)</td>
                      <td><span className="badge" style={{ backgroundColor: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}>Optional</span></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Input Parameters Schema */}
          <div className="card">
            <h3 className="card-title">Input Parameters</h3>
            <p className="card-subtitle">JSON body parameters accepted by this endpoint.</p>

            <div className="table-container" style={{ marginTop: '12px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Parameter Name</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Default</th>
                    <th>Description & Rules</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.parameters.map((param: any) => (
                    <tr key={param.name}>
                      <td><code style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{param.name}</code></td>
                      <td><span className="badge badge-provider">{param.type}</span></td>
                      <td>
                        {param.required ? (
                          <span className="badge badge-active">Required</span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}>Optional</span>
                        )}
                      </td>
                      <td><code>{param.defaultValue || '—'}</code></td>
                      <td>
                        <div>{param.description}</div>
                        {param.validationRules && Object.keys(param.validationRules).length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Rules: <code>{JSON.stringify(param.validationRules)}</code>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Copyable cURL Command */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Executable cURL Example</h3>
              <p className="card-subtitle">Copy and paste into your terminal or API client</p>
            </div>
            <CodeBlock
              title="CURL REQUEST"
              code={docs.sampleCurlCommand}
              language="bash"
            />
          </div>

          {/* Response Schema & Sample Envelopes */}
          <div className="split-view">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Success Response Envelope (200 OK)</h3>
              </div>
              <CodeBlock
                title="HTTP 200 OK RESPONSE"
                code={JSON.stringify(docs.sampleSuccessResponse, null, 2)}
                language="json"
              />
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Standard Error Envelopes</h3>
              </div>
              <CodeBlock
                title="HTTP 400 VALIDATION ERROR"
                code={JSON.stringify(docs.sampleErrorResponse, null, 2)}
                language="json"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
