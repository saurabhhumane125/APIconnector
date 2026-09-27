import React, { useEffect, useState } from 'react';
import { api, RequestLog, Connector } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { CodeBlock } from '../components/CodeBlock';
import { RefreshCw, Filter, Eye, AlertCircle, X } from 'lucide-react';

export const RequestLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [l, c] = await Promise.all([
        api.getLogs({
          connectorId: selectedConnectorId === 'all' ? undefined : selectedConnectorId,
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 100,
        }),
        api.getConnectors(),
      ]);
      setLogs(l);
      setConnectors(c);
    } catch (err) {
      console.error('Failed to fetch request logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedConnectorId, statusFilter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Persistent Request Logs
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Historical execution telemetry stored in SQLite, surviving server restarts and page refreshes.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '18px',
          backgroundColor: 'var(--bg-surface)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
        }}
      >
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '220px' }}
          value={selectedConnectorId}
          onChange={e => setSelectedConnectorId(e.target.value)}
        >
          <option value="all">All Connectors</option>
          {connectors.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '150px' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="success">Success (2xx)</option>
          <option value="error">Errors (4xx, 5xx)</option>
        </select>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">No request logs recorded</div>
            <div className="empty-state-desc">Requests made to your generated endpoints will be recorded here.</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>HTTP</th>
                <th>Connector</th>
                <th>Duration</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Provider & Model</th>
                <th>Timestamp</th>
                <th style={{ textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>
                    <StatusBadge status={log.status} />
                  </td>
                  <td>
                    <StatusBadge status={String(log.http_status)} type="http" />
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {log.connector_name || log.connector_id}
                  </td>
                  <td>{log.duration_ms} ms</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {log.total_tokens || 0}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      ${(log.estimated_cost || 0).toFixed(5)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span className="badge badge-provider">{log.provider}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.model}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedLog(log)}
                      title="Inspect Payload"
                    >
                      <Eye size={13} />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal / Overlay for Log Detail Inspection */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 0,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="card-header">
              <div>
                <h3 className="card-title">Execution Detail: {selectedLog.id}</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                  <StatusBadge status={selectedLog.status} />
                  <StatusBadge status={String(selectedLog.http_status)} type="http" />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {selectedLog.duration_ms} ms · {new Date(selectedLog.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
                <X size={14} />
              </button>
            </div>

            {selectedLog.error_message && (
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
                <div style={{ fontWeight: 600 }}>Error Code: {selectedLog.error_code}</div>
                <div>{selectedLog.error_message}</div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Sanitized Request Inputs
              </h4>
              <CodeBlock
                code={selectedLog.input_payload || '{}'}
                language="json"
              />
            </div>

            <div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Response Payload / Output Data
              </h4>
              <CodeBlock
                code={selectedLog.response_payload || '{}'}
                language="json"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
