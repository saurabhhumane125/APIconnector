import { AIProviderAdapter, ModelInfo, ProviderExecutionOptions, ProviderExecutionResult } from './types';
import { config } from '../config';
import { providerKeyStore } from './providerKeyStore';
import { buildExecutionPrompt } from './promptBuilder';
import { extractJsonFromText, validateOutputAgainstSchema } from '../validation/outputValidator';

export class GroqAdapter implements AIProviderAdapter {
  public readonly id = 'groq';
  public readonly name = 'Groq LPU Acceleration';

  private readonly models: ModelInfo[] = [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile',
      contextWindow: 128000,
      supportsVision: false,
      costPer1kInputTokens: 0.00059,
      costPer1kOutputTokens: 0.00079,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      contextWindow: 128000,
      supportsVision: false,
      costPer1kInputTokens: 0.00005,
      costPer1kOutputTokens: 0.00008,
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'Mixtral 8x7B 32k',
      contextWindow: 32768,
      supportsVision: false,
      costPer1kInputTokens: 0.00024,
      costPer1kOutputTokens: 0.00024,
    },
  ];

  public isConfigured(): boolean {
    return providerKeyStore.isConfigured(this.id);
  }

  public getSupportedModels(): ModelInfo[] {
    return this.models;
  }

  public async execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult> {
    const apiKey = options.apiKeyOverride || providerKeyStore.getKey(this.id);
    if (!apiKey) {
      throw new Error("Provider 'groq' is not configured. Please supply a GROQ_API_KEY.");
    }

    const startTime = Date.now();
    const prompt = buildExecutionPrompt(
      options.systemPrompt,
      options.inputs,
      options.inputDefinitions,
      options.outputSchema
    );

    const bodyPayload: any = {
      model: options.model || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPromptText },
      ],
      temperature: 0.1,
    };

    // If output schema is defined, enable JSON mode
    if (options.outputSchema) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || config.defaultExecutionTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq API returned HTTP ${response.status}: ${errorBody}`);
      }

      const resJson: any = await response.json();
      const rawText = resJson.choices?.[0]?.message?.content || '';

      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      const totalTokens = resJson.usage?.total_tokens || (promptTokens + completionTokens);

      const modelInfo = this.models.find(m => m.id === options.model);
      const inputCost = (promptTokens / 1000) * (modelInfo?.costPer1kInputTokens || 0.00059);
      const outputCost = (completionTokens / 1000) * (modelInfo?.costPer1kOutputTokens || 0.00079);
      const estimatedCost = Number((inputCost + outputCost).toFixed(6));

      // Extract and validate structured output
      let parsedData: any = null;
      if (options.outputSchema) {
        parsedData = extractJsonFromText(rawText);
        const valResult = validateOutputAgainstSchema(parsedData, options.outputSchema);
        if (!valResult.valid) {
          throw new Error(`Output schema validation failed: ${valResult.errors.join('; ')}`);
        }
      } else {
        try {
          parsedData = JSON.parse(rawText);
        } catch {
          parsedData = { text: rawText };
        }
      }

      const durationMs = Date.now() - startTime;

      return {
        provider: this.id,
        model: options.model,
        rawText,
        data: parsedData,
        tokens: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
        estimatedCost,
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Groq request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }
}
