import { AIProviderAdapter, ModelInfo, ProviderExecutionOptions, ProviderExecutionResult } from './types';
import { config } from '../config';
import { buildExecutionPrompt } from './promptBuilder';
import { extractJsonFromText, validateOutputAgainstSchema } from '../validation/outputValidator';

export class AnthropicAdapter implements AIProviderAdapter {
  public readonly id = 'anthropic';
  public readonly name = 'Anthropic Claude';

  private readonly models: ModelInfo[] = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      supportsVision: true,
      costPer1kInputTokens: 0.003,
      costPer1kOutputTokens: 0.015,
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      contextWindow: 200000,
      supportsVision: true,
      costPer1kInputTokens: 0.0008,
      costPer1kOutputTokens: 0.004,
    },
  ];

  public isConfigured(): boolean {
    return Boolean(config.providers.anthropicApiKey);
  }

  public getSupportedModels(): ModelInfo[] {
    return this.models;
  }

  public async execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult> {
    const apiKey = options.apiKeyOverride || config.providers.anthropicApiKey;
    if (!apiKey) {
      throw new Error("Provider 'anthropic' is not configured. Please supply an ANTHROPIC_API_KEY.");
    }

    const startTime = Date.now();
    const prompt = buildExecutionPrompt(
      options.systemPrompt,
      options.inputs,
      options.inputDefinitions,
      options.outputSchema
    );

    const contentParts: any[] = [];
    for (const img of prompt.images) {
      let mediaType = img.mimeType || 'image/jpeg';
      let base64Data = img.urlOrBase64;
      if (base64Data.startsWith('data:')) {
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mediaType = matches[1];
          base64Data = matches[2];
        }
      }
      contentParts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
    }

    if (prompt.userPromptText) {
      contentParts.push({
        type: 'text',
        text: prompt.userPromptText,
      });
    }

    const bodyPayload: any = {
      model: options.model || 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system: prompt.systemPrompt,
      messages: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
      temperature: 0.1,
    };

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || config.defaultExecutionTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Anthropic API returned HTTP ${response.status}: ${errorBody}`);
      }

      const resJson: any = await response.json();
      const rawText = resJson.content?.[0]?.text || '';

      const promptTokens = resJson.usage?.input_tokens || 0;
      const completionTokens = resJson.usage?.output_tokens || 0;
      const totalTokens = promptTokens + completionTokens;

      const modelInfo = this.models.find(m => m.id === options.model);
      const inputCost = (promptTokens / 1000) * (modelInfo?.costPer1kInputTokens || 0.0008);
      const outputCost = (completionTokens / 1000) * (modelInfo?.costPer1kOutputTokens || 0.004);
      const estimatedCost = Number((inputCost + outputCost).toFixed(6));

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
        throw new Error(`Anthropic request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }
}
