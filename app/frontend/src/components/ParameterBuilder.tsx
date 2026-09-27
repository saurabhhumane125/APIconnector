import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export type ParameterType = 'text' | 'number' | 'boolean' | 'image' | 'file' | 'json';

export interface ParamItem {
  id?: string;
  name: string;
  type: ParameterType;
  required: boolean;
  description?: string;
  defaultValue?: string;
  validationRules?: Record<string, any>;
}

interface ParameterBuilderProps {
  parameters: ParamItem[];
  onChange: (parameters: ParamItem[]) => void;
}

export const ParameterBuilder: React.FC<ParameterBuilderProps> = ({ parameters, onChange }) => {
  const addParameter = () => {
    const newParam: ParamItem = {
      name: `param_${parameters.length + 1}`,
      type: 'text',
      required: true,
      description: '',
      defaultValue: '',
      validationRules: {},
    };
    onChange([...parameters, newParam]);
  };

  const removeParameter = (index: number) => {
    const updated = [...parameters];
    updated.splice(index, 1);
    onChange(updated);
  };

  const updateParameter = (index: number, field: keyof ParamItem, value: any) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const moveParameter = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === parameters.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...parameters];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Dynamic Input Parameters ({parameters.length})
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Defines the request schema accepted by the generated API endpoint.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addParameter}>
          <Plus size={14} />
          <span>Add Parameter</span>
        </button>
      </div>

      {parameters.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            No input parameters configured.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addParameter}>
            <Plus size={14} />
            <span>Add First Parameter</span>
          </button>
        </div>
      ) : (
        parameters.map((param, index) => (
          <div
            key={index}
            style={{
              padding: '14px',
              backgroundColor: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 100px auto', gap: '10px', alignItems: 'center' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Parameter Name</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                  placeholder="e.g. ticket_text"
                  value={param.name}
                  onChange={e => updateParameter(index, 'name', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Data Type</label>
                <select
                  className="form-control"
                  value={param.type}
                  onChange={e => updateParameter(index, 'type', e.target.value as ParameterType)}
                >
                  <option value="text">Text (String)</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="image">Image (Multimodal/Base64/URL)</option>
                  <option value="file">File (Base64/Content)</option>
                  <option value="json">JSON (Object/Array)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Required</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', height: '36px' }}>
                  <input
                    type="checkbox"
                    checked={param.required}
                    onChange={e => updateParameter(index, 'required', e.target.checked)}
                  />
                  <span>Required</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '4px', alignSelf: 'flex-end', height: '36px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px' }}
                  onClick={() => moveParameter(index, 'up')}
                  disabled={index === 0}
                  title="Move Up"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px' }}
                  onClick={() => moveParameter(index, 'down')}
                  disabled={index === parameters.length - 1}
                  title="Move Down"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ padding: '6px' }}
                  onClick={() => removeParameter(index)}
                  title="Delete Parameter"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem' }}
                  placeholder="Parameter description for documentation..."
                  value={param.description || ''}
                  onChange={e => updateParameter(index, 'description', e.target.value)}
                />
              </div>

              <div>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                  placeholder="Default value (optional)"
                  value={param.defaultValue || ''}
                  onChange={e => updateParameter(index, 'defaultValue', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
