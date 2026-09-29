export interface Connector {
  id: string;
  name: string;
  slug: string;
  description: string;
  provider: string;
  model: string;
  systemPrompt: string;
  status: 'active' | 'disabled';
  authType: 'none' | 'api_key' | 'bearer_token';
  outputSchema: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  inputParameters: Array<{
    id?: string;
    name: string;
    type: 'text' | 'number' | 'boolean' | 'image' | 'file' | 'json';
    required: boolean;
    description?: string;
    defaultValue?: string;
    validationRules?: Record<string, any>;
    position?: number;
  }>;
}

export interface HubMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRatePercentage: number;
  avgDurationMs: number;
  p95DurationMs: number;
  totalTokens: number;
  totalEstimatedCost: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
  providerBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
}

export interface ApiKeyRecord {
  id: string;
  connectorId: string | null;
  name: string;
  keyPrefix: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
}

export interface RequestLog {
  id: string;
  connector_id: string;
  connector_name?: string;
  connector_slug?: string;
  timestamp: string;
  status: 'success' | 'error';
  http_status: number;
  duration_ms: number;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  input_payload?: string;
  response_payload?: string;
  error_code?: string;
  error_message?: string;
}

export interface ProviderSummary {
  id: string;
  name: string;
  isConfigured: boolean;
  maskedKey?: string | null;
  supportedModels: Array<{
    id: string;
    name: string;
    contextWindow?: number;
    supportsVision: boolean;
    costPer1kInputTokens?: number;
    costPer1kOutputTokens?: number;
  }>;
}


const API_BASE = ''; // Proxy handles routing to backend in dev and prod

export const api = {
  async getConnectors(): Promise<Connector[]> {
    const res = await fetch(`${API_BASE}/api/connectors`);
    const json = await res.json();
    return json.data || [];
  },

  async getConnector(id: string): Promise<Connector> {
    const res = await fetch(`${API_BASE}/api/connectors/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to load connector');
    return json.data;
  },

  async getConnectorDocs(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/connectors/${id}/docs`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to load documentation');
    return json.data;
  },

  async createConnector(dto: any): Promise<Connector> {
    const res = await fetch(`${API_BASE}/api/connectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to create connector');
    return json.data;
  },

  async updateConnector(id: string, dto: any): Promise<Connector> {
    const res = await fetch(`${API_BASE}/api/connectors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to update connector');
    return json.data;
  },

  async toggleStatus(id: string, status: 'active' | 'disabled'): Promise<Connector> {
    const res = await fetch(`${API_BASE}/api/connectors/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to toggle status');
    return json.data;
  },

  async deleteConnector(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/connectors/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return json.success;
  },

  async executeConnector(
    slugOrId: string,
    inputs: Record<string, any>,
    apiKey?: string
  ): Promise<{ status: number; data: any }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const endpoint = slugOrId.startsWith('conn_')
      ? `${API_BASE}/api/v1/connectors/${slugOrId}/execute`
      : `${API_BASE}/api/v1/run/${slugOrId}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(inputs),
    });

    const json = await res.json();
    return { status: res.status, data: json };
  },

  async getMetrics(connectorId?: string): Promise<HubMetrics> {
    const url = connectorId
      ? `${API_BASE}/api/metrics/summary?connectorId=${encodeURIComponent(connectorId)}`
      : `${API_BASE}/api/metrics/summary`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data;
  },

  async getLogs(options?: { connectorId?: string; status?: string; limit?: number }): Promise<RequestLog[]> {
    const params = new URLSearchParams();
    if (options?.connectorId) params.append('connectorId', options.connectorId);
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));

    const res = await fetch(`${API_BASE}/api/metrics/logs?${params.toString()}`);
    const json = await res.json();
    return json.data || [];
  },

  async getKeys(): Promise<ApiKeyRecord[]> {
    const res = await fetch(`${API_BASE}/api/keys`);
    const json = await res.json();
    return json.data || [];
  },

  async createKey(name: string, connectorId?: string | null): Promise<{ record: ApiKeyRecord; secretKey: string }> {
    const res = await fetch(`${API_BASE}/api/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, connectorId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to create API key');
    return json.data;
  },

  async revokeKey(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/keys/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return json.success;
  },

  async getProviders(): Promise<ProviderSummary[]> {
    const res = await fetch(`${API_BASE}/api/providers`);
    const json = await res.json();
    return json.data || [];
  },

  async setProviderKey(providerId: string, apiKey: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/providers/${providerId}/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to save provider key');
    return json.data;
  },

  async removeProviderKey(providerId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/providers/${providerId}/key`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to remove provider key');
    return json.data;
  },

  async getHealth(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/health`);
    return await res.json();
  },
};

