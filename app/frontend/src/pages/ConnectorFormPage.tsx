import React, { useEffect, useState } from 'react';
import { api, Connector, ProviderSummary } from '../lib/api';
import { ParameterBuilder, ParamItem } from '../components/ParameterBuilder';
import { Save, ArrowLeft, AlertCircle, Check } from 'lucide-react';

interface ConnectorFormPageProps {
  connectorId?: string;
  onNavigate: (tab: string, connectorId?: string) => void;
}

export const ConnectorFormPage: React.FC<ConnectorFormPageProps> = ({ connectorId, onNavigate }) => {
  const isEditing = Boolean(connectorId);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');
  const [authType, setAuthType] = useState<'none' | 'api_key' | 'bearer_token'>('none');
  const [parameters, setParameters] = useState<ParamItem[]>([
    { name: 'input_text', type: 'text', required: true, description: 'User input text to process' },
  ]);
  const [outputSchemaStr, setOutputSchemaStr] = useState(
    JSON.stringify(
      {
        type: 'object',
        required: ['result', 'confidence'],
        properties: {
          result: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
      null,
      2
    )
  );

  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const provs = await api.getProviders();
        setProviders(provs);

        if (isEditing && connectorId) {
          const conn = await api.getConnector(connectorId);
          setName(conn.name);
          setSlug(conn.slug);
          setDescription(conn.description || '');
          setProvider(conn.provider);
          setModel(conn.model);
          setSystemPrompt(conn.systemPrompt);
          setStatus(conn.status);
          setAuthType(conn.authType);
          setParameters(conn.inputParameters.map(p => ({
            name: p.name,
            type: p.type,
            required: p.required,
            description: p.description,
            defaultValue: p.defaultValue,
            validationRules: p.validationRules,
          })));
          setOutputSchemaStr(JSON.stringify(conn.outputSchema, null, 2));
        } else {
          // Default to first available provider and model
          const defaultProv = provs.find(p => p.id === 'groq') || provs[0];
          if (defaultProv) {
            setProvider(defaultProv.id);
            if (defaultProv.supportedModels.length > 0) {
              setModel(defaultProv.supportedModels[0].id);
            }
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to initialize form');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [connectorId, isEditing]);

  // Update selected model when provider changes if current model isn't in supported list
  const currentProvider = providers.find(p => p.id === provider);
  const availableModels = currentProvider?.supportedModels || [];

  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.some(m => m.id === model)) {
      setModel(availableModels[0].id);
    }
  }, [provider, availableModels, model]);

  const handleApplyPreset = (type: 'classification' | 'extraction' | 'sentiment') => {
    if (type === 'classification') {
      setOutputSchemaStr(
        JSON.stringify(
          {
            type: 'object',
            required: ['category', 'confidence', 'summary'],
            properties: {
              category: { type: 'string', enum: ['inquiry', 'complaint', 'feedback', 'other'] },
              confidence: { type: 'number' },
              summary: { type: 'string' },
            },
          },
          null,
          2
        )
      );
    } else if (type === 'extraction') {
      setOutputSchemaStr(
        JSON.stringify(
          {
            type: 'object',
            required: ['merchant', 'date', 'total_amount', 'items'],
            properties: {
              merchant: { type: 'string' },
              date: { type: 'string' },
              total_amount: { type: 'number' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['name', 'price'],
                  properties: {
                    name: { type: 'string' },
                    price: { type: 'number' },
                  },
                },
              },
            },
          },
          null,
          2
        )
      );
    } else if (type === 'sentiment') {
      setOutputSchemaStr(
        JSON.stringify(
          {
            type: 'object',
            required: ['sentiment', 'score', 'highlights'],
            properties: {
              sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
              score: { type: 'number' },
              highlights: { type: 'array', items: { type: 'string' } },
            },
          },
          null,
          2
        )
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate JSON Schema
    let parsedSchema: Record<string, any>;
    try {
      parsedSchema = JSON.parse(outputSchemaStr);
      if (typeof parsedSchema !== 'object' || parsedSchema === null) {
        throw new Error('Schema must be a JSON object');
      }
    } catch (err: any) {
      setErrorMsg(`Invalid Output Schema JSON: ${err.message}`);
      return;
    }

    if (parameters.length === 0) {
      setErrorMsg('Please configure at least one input parameter');
      return;
    }

    // Check duplicate parameter names
    const names = new Set<string>();
    for (const p of parameters) {
      if (!p.name.trim()) {
        setErrorMsg('All parameters must have a non-empty name');
        return;
      }
      if (names.has(p.name.trim())) {
        setErrorMsg(`Duplicate parameter name detected: '${p.name.trim()}'`);
        return;
      }
      names.add(p.name.trim());
    }

    const payload = {
      name,
      slug: slug.trim() || undefined,
      description,
      provider,
      model,
      systemPrompt,
      status,
      authType,
      outputSchema: parsedSchema,
      inputParameters: parameters,
    };

    try {
      setSaving(true);
      if (isEditing && connectorId) {
        await api.updateConnector(connectorId, payload);
      } else {
        await api.createConnector(payload);
      }
      onNavigate('connectors');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save connector');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading connector configuration...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('connectors')}>
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isEditing ? `Edit Connector: ${name}` : 'Create New AI API Connector'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Configure provider, input parameters, instructions, and structured response schema.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            backgroundColor: 'var(--color-danger-subtle)',
            color: 'var(--color-danger)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.88rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Section 1: General Metadata */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">1. Connector Metadata</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Connector Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Customer Support Triage"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <div className="form-help">Human-readable descriptive title for the API connector.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Endpoint URL Slug</label>
              <input
                type="text"
                className="form-control"
                style={{ fontFamily: 'var(--font-mono)' }}
                placeholder="auto-generated-from-name"
                value={slug}
                onChange={e => setSlug(e.target.value)}
              />
              <div className="form-help">Route suffix: <code>/api/v1/run/{slug || 'your-slug'}</code></div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Purpose & Description</label>
            <input
              type="text"
              className="form-control"
              placeholder="What this API accomplishes and what consumers should expect..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control"
                value={status}
                onChange={e => setStatus(e.target.value as any)}
              >
                <option value="active">Active (Accepts external execution requests)</option>
                <option value="disabled">Disabled (Returns controlled 403, rejects execution)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Authentication Mode</label>
              <select
                className="form-control"
                value={authType}
                onChange={e => setAuthType(e.target.value as any)}
              >
                <option value="none">None (Public unauthenticated endpoint)</option>
                <option value="api_key">API Key (Header: X-API-Key)</option>
                <option value="bearer_token">Bearer Token (Header: Authorization: Bearer ...)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: AI Provider & Model */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">2. AI Provider Configuration</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">AI Provider *</label>
              <select
                className="form-control"
                value={provider}
                onChange={e => setProvider(e.target.value)}
                required
              >
                {providers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isConfigured ? '(Key Configured)' : '(No Key in .env)'}
                  </option>
                ))}
              </select>
              <div className="form-help">
                Provider-adapter architecture ensures modular execution and key isolation.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">AI Model *</label>
              <select
                className="form-control"
                value={model}
                onChange={e => setModel(e.target.value)}
                required
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.supportsVision ? '— Vision' : ''} ({m.id})
                  </option>
                ))}
              </select>
              <div className="form-help">
                Selected model for provider-specific API invocation.
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">System Instructions / Prompt *</label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="You are an expert system that classifies input data. Adhere strictly to the requested JSON schema..."
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              required
            />
            <div className="form-help">
              Defines the role, task, and behavioral rules sent to the model.
            </div>
          </div>
        </div>

        {/* Section 3: Dynamic Input Parameters */}
        <div className="card">
          <ParameterBuilder parameters={parameters} onChange={setParameters} />
        </div>

        {/* Section 4: Expected Output Schema */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">4. Expected Structured Output Schema (JSON Schema)</h3>
              <p className="card-subtitle">
                The engine forces and validates that the AI model produces structured JSON conforming to this schema.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleApplyPreset('classification')}
              >
                Classification Preset
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleApplyPreset('extraction')}
              >
                Receipt/OCR Preset
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleApplyPreset('sentiment')}
              >
                Sentiment Preset
              </button>
            </div>
          </div>

          <div className="form-group">
            <textarea
              className="form-control"
              rows={9}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}
              value={outputSchemaStr}
              onChange={e => setOutputSchemaStr(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', marginBottom: '40px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('connectors')}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} />
            <span>{saving ? 'Saving...' : isEditing ? 'Update Connector' : 'Create Connector'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
