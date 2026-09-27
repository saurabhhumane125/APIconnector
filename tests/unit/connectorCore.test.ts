import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase, closeDatabase } from '../../database/connection';
import { ConnectorService } from '../../app/backend/connectors/connectorService';
import { validateAndSanitizeInputs } from '../../app/backend/validation/inputValidator';

describe('Phase 3 & 4 - Connector Core & Dynamic Inputs', () => {
  const service = ConnectorService.getInstance();

  beforeAll(() => {
    getDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  it('lists existing seeded connectors', () => {
    const list = service.listConnectors();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some(c => c.slug === 'support-ticket-triage')).toBe(true);
  });

  it('creates a new connector with all input types and retrieves it', () => {
    const uniqueSuffix = Date.now().toString(36);
    const created = service.createConnector({
      name: `Omni Media Classifier ${uniqueSuffix}`,
      description: 'Tests all 6 input types',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'Process all incoming payload fields.',
      status: 'active',
      authType: 'none',
      outputSchema: {
        type: 'object',
        required: ['classified', 'tags'],
        properties: {
          classified: { type: 'boolean' },
          tags: { type: 'array' },
        },
      },
      inputParameters: [
        { name: 'headline', type: 'text', required: true, validationRules: { min_length: 3 } },
        { name: 'confidence_threshold', type: 'number', required: false, defaultValue: '0.8', validationRules: { min: 0, max: 1 } },
        { name: 'include_metadata', type: 'boolean', required: false, defaultValue: 'true' },
        { name: 'cover_image', type: 'image', required: false },
        { name: 'raw_doc', type: 'file', required: false },
        { name: 'extra_config', type: 'json', required: false },
      ],
    });

    expect(created.id).toBeDefined();
    expect(created.slug).toBe(`omni-media-classifier-${uniqueSuffix}`);
    expect(created.inputParameters.length).toBe(6);

    const retrieved = service.getConnectorById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe(`Omni Media Classifier ${uniqueSuffix}`);
  });

  it('generates unique slugs for duplicate connector names', () => {
    const uniquePrefix = `dup-${Date.now().toString(36)}`;
    const conn1 = service.createConnector({
      name: uniquePrefix,
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      systemPrompt: 'Test 1',
      outputSchema: { type: 'object' },
      inputParameters: [],
    });

    const conn2 = service.createConnector({
      name: uniquePrefix,
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      systemPrompt: 'Test 2',
      outputSchema: { type: 'object' },
      inputParameters: [],
    });

    expect(conn1.slug).toBe(uniquePrefix);
    expect(conn2.slug).toBe(`${uniquePrefix}-1`);
  });


  it('validates input parameters correctly with type coercion, defaults, and error reporting', () => {
    const paramDefs = [
      { name: 'query', type: 'text' as const, required: true, validationRules: { min_length: 3 } },
      { name: 'limit', type: 'number' as const, required: false, defaultValue: '10', validationRules: { min: 1, max: 50 } },
      { name: 'activeOnly', type: 'boolean' as const, required: false, defaultValue: 'false' },
    ];

    // 1. Missing required field
    const missingRes = validateAndSanitizeInputs({}, paramDefs);
    expect(missingRes.valid).toBe(false);
    expect(missingRes.errors[0].field).toBe('query');
    expect(missingRes.errors[0].message).toContain('is missing or empty');

    // 2. Out of range number
    const outOfRangeRes = validateAndSanitizeInputs({ query: 'hello', limit: 100 }, paramDefs);
    expect(outOfRangeRes.valid).toBe(false);
    expect(outOfRangeRes.errors[0].message).toContain('cannot exceed 50');

    // 3. Valid input with type coercion and applied default
    const validRes = validateAndSanitizeInputs({ query: 'search terms', activeOnly: 'true' }, paramDefs);
    expect(validRes.valid).toBe(true);
    expect(validRes.sanitizedInputs.query).toBe('search terms');
    expect(validRes.sanitizedInputs.limit).toBe(10); // default applied as number
    expect(validRes.sanitizedInputs.activeOnly).toBe(true); // string 'true' coerced to boolean
  });

  it('toggles connector status between active and disabled', () => {
    const list = service.listConnectors();
    const conn = list[0];
    expect(conn.status).toBe('active');

    const disabled = service.toggleConnectorStatus(conn.id, 'disabled');
    expect(disabled.status).toBe('disabled');

    const activeAgain = service.toggleConnectorStatus(conn.id, 'active');
    expect(activeAgain.status).toBe('active');
  });

  it('deletes connector and cascades cleanup', () => {
    const created = service.createConnector({
      name: 'To Be Deleted',
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      systemPrompt: 'Delete me',
      outputSchema: { type: 'object' },
      inputParameters: [{ name: 'dummy', type: 'text', required: true }],
    });

    const deleted = service.deleteConnector(created.id);
    expect(deleted).toBe(true);
    expect(service.getConnectorById(created.id)).toBeNull();
  });
});
