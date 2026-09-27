import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase, closeDatabase } from '../../database/connection';
import { ConnectorService } from '../../app/backend/connectors/connectorService';
import { ProviderRegistry } from '../../app/backend/providers/registry';
import { ApiKeyService } from '../../app/backend/auth/apiKeyService';
import { ExecutionEngine } from '../../app/backend/connectors/executionEngine';
import { RequestLogger } from '../../app/backend/logging/requestLogger';
import { generateConnectorDocumentation } from '../../app/backend/docs/docGenerator';
import { AIProviderAdapter, ModelInfo, ProviderExecutionOptions, ProviderExecutionResult } from '../../app/backend/providers/types';

describe('Phase 5, 6, 7, 8, 9 - Generated Endpoints, Auth, Docs, Logging', () => {
  const connectorService = ConnectorService.getInstance();
  const providerRegistry = ProviderRegistry.getInstance();
  const apiKeyService = ApiKeyService.getInstance();
  const executionEngine = ExecutionEngine.getInstance();
  const logger = RequestLogger.getInstance();

  let testConnector: any;
  let testConnectorWithAuth: any;

  beforeAll(() => {
    getDatabase();

    // Register a controllable mock provider for E2E integration execution
    class IntegrationMockProvider implements AIProviderAdapter {
      public readonly id = 'integration-mock';
      public readonly name = 'Integration Mock Provider';
      public isConfigured() { return true; }
      public getSupportedModels(): ModelInfo[] {
        return [{ id: 'mock-turbo', name: 'Mock Turbo', supportsVision: true }];
      }
      public async execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult> {
        return {
          provider: this.id,
          model: options.model,
          rawText: JSON.stringify({
            sentiment: 'positive',
            category: 'support',
            confidence: 0.98,
          }),
          data: {
            sentiment: 'positive',
            category: 'support',
            confidence: 0.98,
          },
          tokens: {
            promptTokens: 80,
            completionTokens: 25,
            totalTokens: 105,
          },
          estimatedCost: 0.000045,
          durationMs: 45,
        };
      }
    }

    providerRegistry.register(new IntegrationMockProvider());

    // Create a public test connector
    testConnector = connectorService.createConnector({
      name: 'Integration Test Connector',
      description: 'Used for automated E2E lifecycle test',
      provider: 'integration-mock',
      model: 'mock-turbo',
      systemPrompt: 'Classify support issues.',
      status: 'active',
      authType: 'none',
      outputSchema: {
        type: 'object',
        required: ['sentiment', 'category'],
        properties: {
          sentiment: { type: 'string' },
          category: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
      inputParameters: [
        { name: 'query', type: 'text', required: true, validationRules: { min_length: 3 } },
        { name: 'priority', type: 'number', required: false, defaultValue: '1' },
      ],
    });

    // Create an authenticated test connector
    testConnectorWithAuth = connectorService.createConnector({
      name: 'Auth Protected Connector',
      provider: 'integration-mock',
      model: 'mock-turbo',
      systemPrompt: 'Secure endpoint.',
      status: 'active',
      authType: 'api_key',
      outputSchema: { type: 'object' },
      inputParameters: [{ name: 'token', type: 'text', required: true }],
    });
  });

  afterAll(() => {
    closeDatabase();
  });

  it('executes a connector via slug and returns standard envelope with metrics', async () => {
    const { statusCode, envelope } = await executionEngine.execute(
      testConnector.slug,
      { query: 'Please reset my password', priority: 3 }
    );

    expect(statusCode).toBe(200);
    expect(envelope.success).toBe(true);
    expect(envelope.error).toBeNull();
    expect(envelope.data).toEqual({
      sentiment: 'positive',
      category: 'support',
      confidence: 0.98,
    });
    expect(envelope.meta.connectorSlug).toBe(testConnector.slug);
    expect(envelope.meta.tokens?.total).toBe(105);
    expect(envelope.meta.estimatedCost).toBe(0.000045);
  });

  it('rejects execution when connector is disabled without calling provider', async () => {
    connectorService.toggleConnectorStatus(testConnector.id, 'disabled');

    const { statusCode, envelope } = await executionEngine.execute(
      testConnector.slug,
      { query: 'Valid query' }
    );

    expect(statusCode).toBe(403);
    expect(envelope.success).toBe(false);
    expect(envelope.error?.code).toBe('CONNECTOR_DISABLED');

    // Restore back to active
    connectorService.toggleConnectorStatus(testConnector.id, 'active');
  });

  it('rejects execution when required inputs are missing or invalid', async () => {
    const { statusCode, envelope } = await executionEngine.execute(
      testConnector.slug,
      { priority: 5 } // Missing 'query'
    );

    expect(statusCode).toBe(400);
    expect(envelope.success).toBe(false);
    expect(envelope.error?.code).toBe('VALIDATION_FAILED');
    expect(envelope.error?.details?.[0]?.field).toBe('query');
  });

  it('enforces API key authentication on protected connectors', async () => {
    // 1. Missing key
    const missingRes = await executionEngine.execute(
      testConnectorWithAuth.slug,
      { token: 'valid-input' }
    );
    expect(missingRes.statusCode).toBe(401);
    expect(missingRes.envelope.error?.code).toBe('UNAUTHORIZED');

    // 2. Generate real API key
    const { secretKey } = apiKeyService.generateKey('Test Key', testConnectorWithAuth.id);

    // 3. Call with valid API key
    const successRes = await executionEngine.execute(
      testConnectorWithAuth.slug,
      { token: 'valid-input' },
      { apiKeyHeader: secretKey }
    );
    expect(successRes.statusCode).toBe(200);
    expect(successRes.envelope.success).toBe(true);
  });

  it('generates rich documentation matching the connector schema and cURL example', () => {
    const docs = generateConnectorDocumentation(testConnector, 'https://api.example.com');
    expect(docs.endpointUrl).toBe(`https://api.example.com/api/v1/run/${testConnector.slug}`);
    expect(docs.httpMethod).toBe('POST');
    expect(docs.sampleCurlCommand).toContain('curl -X POST');
    expect(docs.sampleCurlCommand).toContain(testConnector.slug);
    expect(docs.parameters.length).toBe(2);
    expect(docs.sampleSuccessResponse.success).toBe(true);
  });

  it('persists request logs and produces accurate operational metrics', () => {
    const metrics = logger.getMetrics(testConnector.id);
    expect(metrics.totalRequests).toBeGreaterThanOrEqual(1);
    expect(metrics.successfulRequests).toBeGreaterThanOrEqual(1);
    expect(metrics.totalTokens).toBeGreaterThanOrEqual(105);
    expect(metrics.successRatePercentage).toBeGreaterThan(0);

    const logs = logger.getLogs({ connectorId: testConnector.id, limit: 10 });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].connector_id).toBe(testConnector.id);
  });
});
