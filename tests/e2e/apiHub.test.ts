import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createServer } from '../../app/backend/server';
import { getDatabase, closeDatabase } from '../../database/connection';
import { ProviderRegistry } from '../../app/backend/providers/registry';
import { AIProviderAdapter, ModelInfo, ProviderExecutionOptions, ProviderExecutionResult } from '../../app/backend/providers/types';

describe('Phase 11, 12, 13 - End-to-End System & Reliability Verification', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    getDatabase();

    // Register a mock provider for E2E HTTP execution testing
    class E2EMockProvider implements AIProviderAdapter {
      public readonly id = 'e2e-provider';
      public readonly name = 'E2E Test Provider';
      public isConfigured() { return true; }
      public getSupportedModels(): ModelInfo[] {
        return [{ id: 'e2e-model', name: 'E2E Model', supportsVision: true }];
      }
      public async execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult> {
        if (options.inputs.trigger_failure) {
          throw new Error('Simulated upstream AI provider timeout');
        }

        return {
          provider: this.id,
          model: options.model,
          rawText: JSON.stringify({
            sentiment: 'positive',
            category: 'technical',
            summary: `Processed: ${options.inputs.query}`,
          }),
          data: {
            sentiment: 'positive',
            category: 'technical',
            summary: `Processed: ${options.inputs.query}`,
          },
          tokens: {
            promptTokens: 42,
            completionTokens: 18,
            totalTokens: 60,
          },
          estimatedCost: 0.000018,
          durationMs: 38,
        };
      }
    }

    ProviderRegistry.getInstance().register(new E2EMockProvider());

    const app = createServer();
    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  });

  it('GET /api/health returns healthy system status and database connection', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('healthy');
    expect(json.database).toBe('connected');
  });

  it('GET / serves built frontend SPA application', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Universal AI API Hub');
    expect(html).toContain('<div id="root">');
  });

  it('complete lifecycle: create connector -> inspect docs -> generate API key -> execute -> check telemetry', async () => {
    // 1. Create a new protected connector
    const createRes = await fetch(`${baseUrl}/api/connectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Support Triage',
        description: 'End-to-end integration test connector',
        provider: 'e2e-provider',
        model: 'e2e-model',
        systemPrompt: 'Triage incoming messages.',
        status: 'active',
        authType: 'api_key',
        outputSchema: {
          type: 'object',
          required: ['sentiment', 'category'],
          properties: {
            sentiment: { type: 'string' },
            category: { type: 'string' },
            summary: { type: 'string' },
          },
        },
        inputParameters: [
          { name: 'query', type: 'text', required: true, validationRules: { min_length: 5 } },
          { name: 'trigger_failure', type: 'boolean', required: false, defaultValue: 'false' },
        ],
      }),
    });

    expect(createRes.status).toBe(201);
    const createdJson = await createRes.json();
    expect(createdJson.success).toBe(true);
    const connector = createdJson.data;
    expect(connector.slug).toContain('e2e-support-triage');

    // 2. Fetch generated documentation
    const docsRes = await fetch(`${baseUrl}/api/connectors/${connector.id}/docs`);
    expect(docsRes.status).toBe(200);
    const docsJson = await docsRes.json();
    expect(docsJson.data.endpointUrl).toContain(`/api/v1/run/${connector.slug}`);
    expect(docsJson.data.sampleCurlCommand).toContain('curl -X POST');
    expect(docsJson.data.parameters.length).toBe(2);

    // 3. Attempt execution without API key (Must be rejected with 401)
    const unauthRes = await fetch(`${baseUrl}/api/v1/run/${connector.slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Server is running slow' }),
    });
    expect(unauthRes.status).toBe(401);
    const unauthJson = await unauthRes.json();
    expect(unauthJson.success).toBe(false);
    expect(unauthJson.error.code).toBe('UNAUTHORIZED');

    // 4. Generate an API Key for this connector
    const keyRes = await fetch(`${baseUrl}/api/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Client Key', connectorId: connector.id }),
    });
    expect(keyRes.status).toBe(201);
    const keyJson = await keyRes.json();
    const apiKey = keyJson.data.secretKey;
    expect(apiKey).toMatch(/^hub_live_/);

    // 5. Attempt execution with missing required parameter (Must be rejected with 400)
    const invalidRes = await fetch(`${baseUrl}/api/v1/run/${connector.slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ trigger_failure: false }), // Missing 'query'
    });
    expect(invalidRes.status).toBe(400);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.success).toBe(false);
    expect(invalidJson.error.code).toBe('VALIDATION_FAILED');
    expect(invalidJson.error.details[0].field).toBe('query');

    // 6. Execute successful request with valid inputs and API key
    const successRes = await fetch(`${baseUrl}/api/v1/run/${connector.slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ query: 'Database latency is spiking above 500ms' }),
    });
    expect(successRes.status).toBe(200);
    const successJson = await successRes.json();
    expect(successJson.success).toBe(true);
    expect(successJson.data.sentiment).toBe('positive');
    expect(successJson.data.category).toBe('technical');
    expect(successJson.meta.tokens.total).toBe(60);
    expect(successJson.meta.estimatedCost).toBe(0.000018);

    // 7. Test simulated upstream provider failure handling (Must return controlled 502, no raw stack traces)
    const failRes = await fetch(`${baseUrl}/api/v1/run/${connector.slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ query: 'Will timeout', trigger_failure: true }),
    });
    expect(failRes.status).toBe(502);
    const failJson = await failRes.json();
    expect(failJson.success).toBe(false);
    expect(failJson.error.code).toBe('PROVIDER_EXECUTION_ERROR');
    expect(failJson.error.message).toContain('Simulated upstream AI provider timeout');

    // 8. Disable connector and verify rejection (Must return 403 without invoking provider)
    await fetch(`${baseUrl}/api/connectors/${connector.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disabled' }),
    });

    const disabledRes = await fetch(`${baseUrl}/api/v1/run/${connector.slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ query: 'Test on disabled connector' }),
    });
    expect(disabledRes.status).toBe(403);
    const disabledJson = await disabledRes.json();
    expect(disabledJson.error.code).toBe('CONNECTOR_DISABLED');

    // 9. Inspect operational metrics and logs
    const metricsRes = await fetch(`${baseUrl}/api/metrics/summary?connectorId=${connector.id}`);
    expect(metricsRes.status).toBe(200);
    const metricsJson = await metricsRes.json();
    expect(metricsJson.data.totalRequests).toBeGreaterThanOrEqual(3); // 400, 200, 502, 403
    expect(metricsJson.data.successfulRequests).toBe(1);
    expect(metricsJson.data.failedRequests).toBeGreaterThanOrEqual(2);

    const logsRes = await fetch(`${baseUrl}/api/metrics/logs?connectorId=${connector.id}`);
    expect(logsRes.status).toBe(200);
    const logsJson = await logsRes.json();
    expect(logsJson.data.length).toBeGreaterThanOrEqual(3);
  });
});
