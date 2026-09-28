import { AIProviderAdapter, ModelInfo, ProviderExecutionOptions, ProviderExecutionResult } from './types';
import { config } from '../config';
import { buildExecutionPrompt } from './promptBuilder';
import { extractJsonFromText, validateOutputAgainstSchema } from '../validation/outputValidator';

export class GeminiAdapter implements AIProviderAdapter {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini';

  private readonly models: ModelInfo[] = [
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextWindow: 1048576,
      supportsVision: true,
      costPer1kInputTokens: 0.000075,
      costPer1kOutputTokens: 0.00030,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextWindow: 2097152,
      supportsVision: true,
      costPer1kInputTokens: 0.00125,
      costPer1kOutputTokens: 0.0050,
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      contextWindow: 1048576,
      supportsVision: true,
      costPer1kInputTokens: 0.00010,
      costPer1kOutputTokens: 0.00040,
    },
  ];

  public isConfigured(): boolean {
    return Boolean(config.providers.geminiApiKey);
  }

  public getSupportedModels(): ModelInfo[] {
    return this.models;
  }

  public async execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult> {
    const apiKey = options.apiKeyOverride || config.providers.geminiApiKey;
    if (!apiKey) {
      throw new Error("Provider 'gemini' is not configured. Please supply a GEMINI_API_KEY.");
    }

    const startTime = Date.now();
    const prompt = buildExecutionPrompt(
      options.systemPrompt,
      options.inputs,
      options.inputDefinitions,
      options.outputSchema
    );

    const parts: any[] = [];
    if (prompt.userPromptText) {
      parts.push({ text: prompt.userPromptText });
    }

    // Add multimodal inlineData parts for images
    for (const img of prompt.images) {
      let mimeType = img.mimeType || 'image/jpeg';
      let base64Data = img.urlOrBase64;

      if (base64Data.startsWith('data:')) {
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    const modelName = options.model || 'gemini-1.5-flash';
    const bodyPayload: any = {
      systemInstruction: {
        parts: [{ text: prompt.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    };

    if (options.outputSchema) {
      bodyPayload.generationConfig.responseMimeType = 'application/json';
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || config.defaultExecutionTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API returned HTTP ${response.status}: ${errorBody}`);
      }

      const resJson: any = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const promptTokens = resJson.usageMetadata?.promptTokenCount || 0;
      const completionTokens = resJson.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = resJson.usageMetadata?.totalTokenCount || (promptTokens + completionTokens);

      const modelInfo = this.models.find(m => m.id === options.model);
      const inputCost = (promptTokens / 1000) * (modelInfo?.costPer1kInputTokens || 0.000075);
      const outputCost = (completionTokens / 1000) * (modelInfo?.costPer1kOutputTokens || 0.00030);
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
        throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }
}
