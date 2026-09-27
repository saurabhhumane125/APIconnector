import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Layers, Activity, BookOpen, Key, Terminal, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api.getHealth()
      .then(res => setHealthy(res.status === 'healthy'))
      .catch(() => setHealthy(false));
  }, []);

  return (
    <header className="navbar">
      <div className="nav-brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
        <Layers size={20} color="var(--color-primary)" />
        <span>AI API HUB</span>
        <span className="nav-brand-badge">PROD</span>
      </div>

      <nav className="nav-links">
        <button
          className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Activity size={16} />
          <span>Dashboard</span>
        </button>

        <button
          className={`nav-link ${activeTab === 'connectors' ? 'active' : ''}`}
          onClick={() => setActiveTab('connectors')}
        >
          <Layers size={16} />
          <span>Connectors</span>
        </button>

        <button
          className={`nav-link ${activeTab === 'test' ? 'active' : ''}`}
          onClick={() => setActiveTab('test')}
        >
          <Terminal size={16} />
          <span>Test API</span>
        </button>

        <button
          className={`nav-link ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => setActiveTab('docs')}
        >
          <BookOpen size={16} />
          <span>API Docs</span>
        </button>

        <button
          className={`nav-link ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Activity size={16} />
          <span>Request Logs</span>
        </button>

        <button
          className={`nav-link ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          <Key size={16} />
          <span>API Keys</span>
        </button>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: healthy ? 'var(--color-success-subtle)' : 'var(--color-danger-subtle)',
            color: healthy ? 'var(--color-success)' : 'var(--color-danger)',
            border: `1px solid ${healthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          }}
        >
          <ShieldCheck size={13} />
          <span>{healthy === null ? 'CHECKING...' : healthy ? 'SYSTEM ONLINE' : 'DEGRADED'}</span>
        </div>
      </div>
    </header>
  );
};
