import React, { useEffect, useState } from 'react';
import { api, Connector } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { CodeBlock } from '../components/CodeBlock';
import { Play, Clock, Zap, DollarSign, AlertCircle, CheckCircle2, Image as ImageIcon, Key, Terminal } from 'lucide-react';

interface TestConnectorPageProps {
  initialConnectorId?: string;
}

export const TestConnectorPage: React.FC<TestConnectorPageProps> = ({ initialConnectorId }) => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>(initialConnectorId || '');
  const [connector, setConnector] = useState<Connector | null>(null);

  // Form input state keyed by parameter name
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [authKey, setAuthKey] = useState<string>('');

  // Execution state & results
  const [executing, setExecuting] = useState<boolean>(false);
  const [result, setResult] = useState<{
    status: number;
    envelope: any;
    durationMs?: number;
  } | null>(null);

  // Load all connectors
  useEffect(() => {
    api.getConnectors().then(list => {
      setConnectors(list);
      if (!selectedConnectorId && list.length > 0) {
        setSelectedConnectorId(list[0].id);
      }
    });
  }, []);

  // When selected connector changes, load its definition and prefill form defaults
  useEffect(() => {
    if (!selectedConnectorId) return;

    api.getConnector(selectedConnectorId)
      .then(conn => {
        setConnector(conn);
        setResult(null);

        // Populate initial defaults
        const defaults: Record<string, any> = {};
        for (const p of conn.inputParameters) {
          if (p.defaultValue !== undefined && p.defaultValue !== '') {
            if (p.type === 'number') defaults[p.name] = Number(p.defaultValue);
            else if (p.type === 'boolean') defaults[p.name] = p.defaultValue === 'true';
            else defaults[p.name] = p.defaultValue;
          } else {
            if (p.type === 'number') defaults[p.name] = 1;
            else if (p.type === 'boolean') defaults[p.name] = false;
            else if (p.type === 'json') defaults[p.name] = '{}';
            else if (p.name.includes('ticket') || p.name.includes('message')) {
              defaults[p.name] = 'I upgraded my subscription plan yesterday but my account features are still locked.';
            } else {
              defaults[p.name] = '';
            }
          }
        }
        setInputValues(defaults);
      })
      .catch(err => console.error('Failed to load connector:', err));
  }, [selectedConnectorId]);

  const handleInputChange = (name: string, value: any) => {
    setInputValues(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (paramName: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleInputChange(paramName, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connector) return;

    setExecuting(true);
    setResult(null);
    const start = Date.now();

    try {
      // Process inputs: if param is type 'json' and string, parse it
      const processedInputs: Record<string, any> = { ...inputValues };
      for (const p of connector.inputParameters) {
        if (p.type === 'json' && typeof processedInputs[p.name] === 'string') {
          try {
            processedInputs[p.name] = JSON.parse(processedInputs[p.name]);
          } catch {
            // Let the backend validator handle invalid JSON
          }
        }
      }

      const res = await api.executeConnector(connector.slug, processedInputs, authKey || undefined);
      const durationMs = Date.now() - start;

      setResult({
        status: res.status,
        envelope: res.data,
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Date.now() - start;
      setResult({
        status: 500,
        envelope: {
          success: false,
          data: null,
          error: { code: 'CLIENT_REQUEST_ERROR', message: err.message },
          meta: { durationMs },
        },
        durationMs,
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Live Test API Interface
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Execute real HTTP requests against your generated connector endpoints.
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
                {c.name} ({c.provider} - {c.model}) [{c.status}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {!connector ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Select a connector to begin testing.</p>
        </div>
      ) : (
        <div className="split-view">
          {/* Left Column: Dynamic Request Form */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Dynamic Request Parameters</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                  <code style={{ fontSize: '0.78rem', color: 'var(--color-primary)' }}>POST /api/v1/run/{connector.slug}</code>
                  <StatusBadge status={connector.status} />
                  <span className="badge badge-provider">{connector.provider}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Authentication header input if connector requires auth */}
              {connector.authType !== 'none' && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-inset)',
                    border: '1px solid var(--border-default)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                  }}
                >
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={14} color="var(--color-warning)" />
                    <span>API Authentication Key ({connector.authType}) *</span>
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                    placeholder="hub_live_..."
                    value={authKey}
                    onChange={e => setAuthKey(e.target.value)}
                  />
                  <div className="form-help">
                    Connector requires authentication. Generate an API Key in the "API Keys" tab.
                  </div>
                </div>
              )}

              {/* Dynamically Render Inputs Based on Parameter Definitions */}
              {connector.inputParameters.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  This connector accepts an empty body.
                </p>
              ) : (
                connector.inputParameters.map(param => (
                  <div key={param.name} className="form-group">
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        <code style={{ fontFamily: 'var(--font-mono)' }}>{param.name}</code>{' '}
                        {param.required ? <span style={{ color: 'var(--color-danger)' }}>*</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(optional)</span>}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {param.type}
                      </span>
                    </label>

                    {/* Text input */}
                    {param.type === 'text' && (
                      <textarea
                        className="form-control"
                        rows={param.name.includes('text') || param.name.includes('message') ? 4 : 2}
                        placeholder={param.description || `Enter ${param.name}...`}
                        value={inputValues[param.name] ?? ''}
                        onChange={e => handleInputChange(param.name, e.target.value)}
                        required={param.required}
                      />
                    )}

                    {/* Number input */}
                    {param.type === 'number' && (
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        placeholder={param.description || '0'}
                        value={inputValues[param.name] ?? ''}
                        onChange={e => handleInputChange(param.name, e.target.value === '' ? '' : Number(e.target.value))}
                        required={param.required}
                      />
                    )}

                    {/* Boolean input */}
                    {param.type === 'boolean' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 0' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(inputValues[param.name])}
                          onChange={e => handleInputChange(param.name, e.target.checked)}
                        />
                        <span style={{ fontSize: '0.88rem' }}>{param.description || `Enable ${param.name}`}</span>
                      </label>
                    )}

                    {/* Image Input (Multimodal) */}
                    {param.type === 'image' && (
                      <div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                handleImageUpload(param.name, e.target.files[0]);
                              }
                            }}
                          />
                        </div>
                        <input
                          type="text"
                          className="form-control"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                          placeholder="Or paste public image URL / base64 data URI..."
                          value={typeof inputValues[param.name] === 'string' && inputValues[param.name].startsWith('data:image/') ? '[Base64 Image Attached]' : inputValues[param.name] ?? ''}
                          onChange={e => handleInputChange(param.name, e.target.value)}
                          required={param.required}
                        />
                        {typeof inputValues[param.name] === 'string' && inputValues[param.name].startsWith('data:image/') && (
                          <div style={{ marginTop: '8px' }}>
                            <img
                              src={inputValues[param.name]}
                              alt="Upload preview"
                              style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* File Input */}
                    {param.type === 'file' && (
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="File string contents or base64..."
                        value={inputValues[param.name] ?? ''}
                        onChange={e => handleInputChange(param.name, e.target.value)}
                        required={param.required}
                      />
                    )}

                    {/* JSON Input */}
                    {param.type === 'json' && (
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder='{"key": "value"}'
                        value={typeof inputValues[param.name] === 'object' ? JSON.stringify(inputValues[param.name], null, 2) : inputValues[param.name] ?? ''}
                        onChange={e => handleInputChange(param.name, e.target.value)}
                        required={param.required}
                      />
                    )}

                    {param.description && <div className="form-help">{param.description}</div>}
                  </div>
                ))
              )}

              <div style={{ marginTop: '20px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={executing}
                >
                  <Play size={16} />
                  <span>{executing ? 'Executing AI Provider Request...' : 'Send Live Test Request'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Results Inspector */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Live Response Inspector</h3>
                <p className="card-subtitle">Real execution telemetry, status envelope, and validated output</p>
              </div>
              {result && <StatusBadge status={String(result.status)} type="http" />}
            </div>

            {!result && !executing ? (
              <div className="empty-state">
                <Terminal size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <div className="empty-state-title">Ready for Request</div>
                <div className="empty-state-desc">
                  Fill in the input parameters and click "Send Live Test Request" to trigger backend execution.
                </div>
              </div>
            ) : executing ? (
              <div className="empty-state">
                <Clock size={32} style={{ color: 'var(--color-primary)', marginBottom: '8px', animation: 'spin 2s linear infinite' }} />
                <div className="empty-state-title">Calling AI Provider...</div>
                <div className="empty-state-desc">
                  Validating parameters, loading {connector.provider} adapter, invoking {connector.model}, and normalizing output schema.
                </div>
              </div>
            ) : (
              <div>
                {/* Telemetry Bar */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    backgroundColor: 'var(--bg-inset)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latency</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {result?.envelope?.meta?.durationMs ?? result?.durationMs} ms
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Tokens</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {result?.envelope?.meta?.tokens?.total ?? 0}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimated Cost</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ${(result?.envelope?.meta?.estimatedCost ?? 0).toFixed(6)}
                    </div>
                  </div>
                </div>

                {/* Error Banner if execution failed */}
                {!result?.envelope?.success && (
                  <div
                    style={{
                      backgroundColor: 'var(--color-danger-subtle)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '16px',
                      color: 'var(--color-danger)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={15} />
                      <span>{result?.envelope?.error?.code || 'ERROR'}</span>
                    </div>
                    <p style={{ marginTop: '4px' }}>{result?.envelope?.error?.message}</p>
                    {result?.envelope?.error?.details && (
                      <pre style={{ marginTop: '6px', fontSize: '0.75rem', background: 'none', padding: 0 }}>
                        {JSON.stringify(result.envelope.error.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Structured JSON Response */}
                <CodeBlock
                  title="HTTP RESPONSE ENVELOPE (JSON)"
                  code={JSON.stringify(result?.envelope, null, 2)}
                  language="json"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
