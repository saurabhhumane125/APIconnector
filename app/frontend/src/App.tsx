import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { ConnectorsListPage } from './pages/ConnectorsListPage';
import { ConnectorFormPage } from './pages/ConnectorFormPage';
import { TestConnectorPage } from './pages/TestConnectorPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { RequestLogsPage } from './pages/RequestLogsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { ProvidersPage } from './pages/ProvidersPage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [targetConnectorId, setTargetConnectorId] = useState<string | undefined>(undefined);

  const handleNavigate = (tab: string, connectorId?: string) => {
    setTargetConnectorId(connectorId);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab.split('-')[0]} setActiveTab={handleNavigate} />

      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}

        {activeTab === 'connectors' && <ConnectorsListPage onNavigate={handleNavigate} />}

        {activeTab === 'connectors-new' && (
          <ConnectorFormPage onNavigate={handleNavigate} />
        )}

        {activeTab === 'connectors-edit' && (
          <ConnectorFormPage connectorId={targetConnectorId} onNavigate={handleNavigate} />
        )}

        {activeTab === 'test' && (
          <TestConnectorPage initialConnectorId={targetConnectorId} onNavigate={handleNavigate} />
        )}

        {activeTab === 'docs' && (
          <DocumentationPage initialConnectorId={targetConnectorId} />
        )}

        {activeTab === 'logs' && <RequestLogsPage />}

        {activeTab === 'keys' && <ApiKeysPage />}

        {activeTab === 'providers' && <ProvidersPage />}
      </main>
    </div>
  );
};


export default App;
