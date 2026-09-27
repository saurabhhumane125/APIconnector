import React, { useEffect, useState } from 'react';
import { api, HubMetrics, Connector, RequestLog } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { Activity, Layers, Zap, Clock, DollarSign, Plus, Play, BookOpen, AlertCircle } from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: string, connectorId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<HubMetrics | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [recentLogs, setRecentLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [m, c, l] = await Promise.all([
        api.getMetrics(),
        api.getConnectors(),
        api.getLogs({ limit: 8 }),
      ]);
      setMetrics(m);
      setConnectors(c);
      setRecentLogs(l);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (connector: Connector) => {
    const nextStatus = connector.status === 'active' ? 'disabled' : 'active';
    try {
      await api.toggleStatus(connector.id, nextStatus);
      loadData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            System Dashboard
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Operational metrics, persistent request telemetry, and active AI connectors.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('connectors-new')}>
            <Plus size={16} />
            <span>Create Connector</span>
          </button>
        </div>
      </div>

      {/* Real Persistent Operational Metrics */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total API Executions</div>
          <div className="stat-value">{metrics ? metrics.totalRequests.toLocaleString() : '—'}</div>
          <div className="stat-meta">
            {metrics?.successfulRequests || 0} successful · {metrics?.failedRequests || 0} failed
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value" style={{ color: (metrics?.successRatePercentage ?? 100) >= 90 ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {metrics ? `${metrics.successRatePercentage}%` : '—'}
          </div>
          <div className="stat-meta">Across all live connectors</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">P95 Response Latency</div>
          <div className="stat-value">{metrics ? `${metrics.p95DurationMs} ms` : '—'}</div>
          <div className="stat-meta">Average: {metrics ? `${metrics.avgDurationMs} ms` : '—'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Tokens & Est. Cost</div>
          <div className="stat-value">{metrics ? metrics.totalTokens.toLocaleString() : '—'}</div>
          <div className="stat-meta">
            Est. Cost: ${metrics ? metrics.totalEstimatedCost.toFixed(5) : '0.00000'}
          </div>
        </div>
      </div>

      {/* Connectors Quick Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Configured AI Connectors ({connectors.length})</h2>
            <p className="card-subtitle">Authoritative database-driven AI endpoints</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('connectors')}>
            View All Connectors
          </button>
        </div>

        {connectors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No Connectors Configured</div>
            <div className="empty-state-desc">Create your first AI API connector to expose a live endpoint.</div>
            <button className="btn btn-primary" onClick={() => onNavigate('connectors-new')}>
              <Plus size={14} />
              <span>Create Connector</span>
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Connector Name</th>
                  <th>Endpoint Slug</th>
                  <th>Provider / Model</th>
                  <th>Auth</th>
                  <th>Inputs</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {connectors.map(c => (
                  <tr key={c.id}>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.description || 'No description'}</div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.78rem', color: 'var(--color-primary)' }}>/api/v1/run/{c.slug}</code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className="badge badge-provider">{c.provider}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.model}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-auth">{c.authType}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {c.inputParameters?.length || 0} fields
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onNavigate('test', c.id)}
                          title="Test Connector"
                        >
                          <Play size={13} />
                          <span>Test</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onNavigate('docs', c.id)}
                          title="View API Docs"
                        >
                          <BookOpen size={13} />
                          <span>Docs</span>
                        </button>
                        <button
                          className={`btn btn-sm ${c.status === 'active' ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => handleToggleStatus(c)}
                        >
                          {c.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Request Telemetry Feed */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent API Activity</h2>
            <p className="card-subtitle">Real execution logs recorded in persistent SQLite storage</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('logs')}>
            View All Logs
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No Requests Recorded Yet</div>
            <div className="empty-state-desc">Requests submitted via Test API or external HTTP clients will appear here.</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Result</th>
                  <th>HTTP</th>
                  <th>Connector</th>
                  <th>Latency</th>
                  <th>Provider / Model</th>
                  <th>Tokens</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <StatusBadge status={log.status} />
                    </td>
                    <td>
                      <StatusBadge status={String(log.http_status)} type="http" />
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {log.connector_name || log.connector_id}
                    </td>
                    <td>{log.duration_ms} ms</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {log.provider} ({log.model})
                      </span>
                    </td>
                    <td>{log.total_tokens || 0}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
