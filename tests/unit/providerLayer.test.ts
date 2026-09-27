import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../../app/backend/providers/registry';
import { AIProviderAdapter, ModelInfo, ProviderExecutionOptions, ProviderExecutionResult } from '../../app/backend/providers/types';
import { buildExecutionPrompt } from '../../app/backend/providers/promptBuilder';
import { extractJsonFromText, validateOutputAgainstSchema } from '../../app/backend/validation/outputValidator';

describe('Phase 2 Provider Layer - Adapters & Contract', () => {
  const registry = ProviderRegistry.getInstance();

  it('registers all default providers: groq, openai, gemini, anthropic', () => {
    const providers = registry.list();
    const ids = providers.map(p => p.id);
    expect(ids).toContain('groq');
    expect(ids).toContain('openai');
    expect(ids).toContain('gemini');
    expect(ids).toContain('anthropic');
  });

  it('provides supported models with capability metadata for each provider', () => {
    const openai = registry.get('openai');
    const models = openai.getSupportedModels();
    expect(models.length).toBeGreaterThan(0);
    const gpt4oMini = models.find(m => m.id === 'gpt-4o-mini');
    expect(gpt4oMini).toBeDefined();
    expect(gpt4oMini?.supportsVision).toBe(true);
    expect(gpt4oMini?.costPer1kInputTokens).toBeGreaterThan(0);
  });

  it('can register a custom mock adapter conforming to the AIProviderAdapter contract', async () => {
    class MockAdapter implements AIProviderAdapter {
      public readonly id = 'test-mock';
      public readonly name = 'Test Mock Provider';
      public isConfigured() { return true; }
      public getSupportedModels(): ModelInfo[] {
        return [{ id: 'mock-model-v1', name: 'Mock Model', supportsVision: true }];
      }
      public async execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult> {
        return {
          provider: this.id,
          model: options.model,
          rawText: JSON.stringify({ sentiment: 'positive', score: 0.95 }),
          data: { sentiment: 'positive', score: 0.95 },
          tokens: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
          estimatedCost: 0.000035,
          durationMs: 42,
        };
      }
    }

    registry.register(new MockAdapter());
    expect(registry.has('test-mock')).toBe(true);

    const adapter = registry.get('test-mock');
    const result = await adapter.execute({
      model: 'mock-model-v1',
      systemPrompt: 'Classify sentiment',
      inputs: { text: 'I love this platform!' },
      inputDefinitions: [{ name: 'text', type: 'text', required: true }],
    });

    expect(result.data.sentiment).toBe('positive');
    expect(result.tokens.totalTokens).toBe(70);
    expect(result.durationMs).toBe(42);
  });

  it('builds execution prompts formatting inputs and schema instructions', () => {
    const prompt = buildExecutionPrompt(
      'You are a support bot.',
      { message: 'Where is my order?', priority: 2 },
      [
        { name: 'message', type: 'text', required: true },
        { name: 'priority', type: 'number', required: false },
      ],
      { type: 'object', required: ['status'] }
    );

    expect(prompt.systemPrompt).toContain('OUTPUT FORMAT SPECIFICATION');
    expect(prompt.userPromptText).toContain("[Input 'message' (text)]: Where is my order?");
    expect(prompt.userPromptText).toContain("[Input 'priority' (number)]: 2");
  });

  it('extracts JSON safely from markdown fences and raw text', () => {
    const markdownOutput = 'Here is the response:\n```json\n{"action": "refund", "approved": true}\n```\nHope that helps!';
    const parsed = extractJsonFromText(markdownOutput);
    expect(parsed).toEqual({ action: 'refund', approved: true });

    const rawOutput = '{"category": "billing"}';
    expect(extractJsonFromText(rawOutput)).toEqual({ category: 'billing' });
  });

  it('validates structured outputs against JSON schemas', () => {
    const schema = {
      type: 'object',
      required: ['category', 'score'],
      properties: {
        category: { type: 'string', enum: ['tech', 'billing'] },
        score: { type: 'number' },
      },
    };

    const validData = { category: 'tech', score: 95 };
    const validRes = validateOutputAgainstSchema(validData, schema);
    expect(validRes.valid).toBe(true);

    const missingField = { category: 'tech' };
    const invalidRes1 = validateOutputAgainstSchema(missingField, schema);
    expect(invalidRes1.valid).toBe(false);
    expect(invalidRes1.errors[0]).toContain("Required field 'score' is missing");

    const invalidEnum = { category: 'invalid-cat', score: 10 };
    const invalidRes2 = validateOutputAgainstSchema(invalidEnum, schema);
    expect(invalidRes2.valid).toBe(false);
    expect(invalidRes2.errors[0]).toContain('not in allowed enum');
  });
});
