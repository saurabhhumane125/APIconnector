import { AIProviderAdapter, ModelInfo, ProviderExecutionOptions, ProviderExecutionResult } from './types';
import { config } from '../config';
import { buildExecutionPrompt } from './promptBuilder';
import { extractJsonFromText, validateOutputAgainstSchema } from '../validation/outputValidator';

export class OpenAIAdapter implements AIProviderAdapter {
  public readonly id = 'openai';
  public readonly name = 'OpenAI';

  private readonly models: ModelInfo[] = [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      supportsVision: true,
      costPer1kInputTokens: 0.00015,
      costPer1kOutputTokens: 0.00060,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128000,
      supportsVision: true,
      costPer1kInputTokens: 0.0025,
      costPer1kOutputTokens: 0.010,
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextWindow: 128000,
      supportsVision: true,
      costPer1kInputTokens: 0.01,
      costPer1kOutputTokens: 0.03,
    },
  ];

  public isConfigured(): boolean {
    return Boolean(config.providers.openaiApiKey);
  }

  public getSupportedModels(): ModelInfo[] {
    return this.models;
  }

  public async execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult> {
    const apiKey = options.apiKeyOverride || config.providers.openaiApiKey;
    if (!apiKey) {
      throw new Error("Provider 'openai' is not configured. Please supply an OPENAI_API_KEY.");
    }

    const startTime = Date.now();
    const prompt = buildExecutionPrompt(
      options.systemPrompt,
      options.inputs,
      options.inputDefinitions,
      options.outputSchema
    );

    // Build user content parts (text and image_url if multimodal)
    let userContent: any;
    if (prompt.images.length > 0) {
      userContent = [];
      if (prompt.userPromptText) {
        userContent.push({ type: 'text', text: prompt.userPromptText });
      }
      for (const img of prompt.images) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: img.urlOrBase64,
            detail: 'auto',
          },
        });
      }
    } else {
      userContent = prompt.userPromptText;
    }

    const bodyPayload: any = {
      model: options.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
    };

    if (options.outputSchema) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || config.defaultExecutionTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        throw new Error(`OpenAI API returned HTTP ${response.status}: ${errorBody}`);
      }

      const resJson: any = await response.json();
      const rawText = resJson.choices?.[0]?.message?.content || '';

      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      const totalTokens = resJson.usage?.total_tokens || (promptTokens + completionTokens);

      const modelInfo = this.models.find(m => m.id === options.model);
      const inputCost = (promptTokens / 1000) * (modelInfo?.costPer1kInputTokens || 0.00015);
      const outputCost = (completionTokens / 1000) * (modelInfo?.costPer1kOutputTokens || 0.00060);
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
        throw new Error(`OpenAI request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }
}
