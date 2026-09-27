import React, { useEffect, useState } from 'react';
import { api, Connector } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { Plus, Play, BookOpen, Edit2, Trash2, Search, Filter } from 'lucide-react';

interface ConnectorsListPageProps {
  onNavigate: (tab: string, connectorId?: string) => void;
}

export const ConnectorsListPage: React.FC<ConnectorsListPageProps> = ({ onNavigate }) => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      const list = await api.getConnectors();
      setConnectors(list);
    } catch (err) {
      console.error('Failed to load connectors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnectors();
  }, []);

  const handleToggleStatus = async (connector: Connector) => {
    const nextStatus = connector.status === 'active' ? 'disabled' : 'active';
    try {
      await api.toggleStatus(connector.id, nextStatus);
      loadConnectors();
    } catch (err: any) {
      alert(`Error toggling status: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete connector '${name}'?`)) {
      return;
    }
    try {
      await api.deleteConnector(id);
      loadConnectors();
    } catch (err: any) {
      alert(`Error deleting connector: ${err.message}`);
    }
  };

  const filtered = connectors.filter(c => {
    const matchQuery =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());

    const matchProvider = providerFilter === 'all' || c.provider === providerFilter;
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchQuery && matchProvider && matchStatus;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            AI Connectors ({filtered.length})
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Configured endpoints that dynamically adapt AI providers into standardized APIs.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('connectors-new')}>
          <Plus size={16} />
          <span>New Connector</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '18px',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-surface)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, slug, or purpose..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '150px' }}
          value={providerFilter}
          onChange={e => setProviderFilter(e.target.value)}
        >
          <option value="all">All Providers</option>
          <option value="groq">Groq</option>
          <option value="openai">OpenAI</option>
          <option value="gemini">Google Gemini</option>
          <option value="anthropic">Anthropic</option>
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '140px' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="disabled">Disabled Only</option>
        </select>
      </div>

      {/* Connectors Table */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">No matching connectors found</div>
            <div className="empty-state-desc">Try clearing your filters or create a new connector.</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Connector Name & Description</th>
                <th>Endpoint Route</th>
                <th>Provider & Model</th>
                <th>Auth Type</th>
                <th>Parameters</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '380px' }}>
                      {c.description || 'No description'}
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>/api/v1/run/{c.slug}</code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="badge badge-provider" style={{ alignSelf: 'flex-start' }}>{c.provider}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{c.model}</span>
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
                        title="Run Live Test"
                      >
                        <Play size={13} />
                        <span>Test</span>
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onNavigate('docs', c.id)}
                        title="View Documentation"
                      >
                        <BookOpen size={13} />
                        <span>Docs</span>
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onNavigate('connectors-edit', c.id)}
                        title="Edit Connector"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        className={`btn btn-sm ${c.status === 'active' ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => handleToggleStatus(c)}
                      >
                        {c.status === 'active' ? 'Disable' : 'Enable'}
                      </button>

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(c.id, c.name)}
                        title="Delete Connector"
                      >
                        <Trash2 size={13} />
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
  );
};
