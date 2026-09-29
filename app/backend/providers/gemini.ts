import { AIProviderAdapter, ModelInfo, ProviderExecutionOptions, ProviderExecutionResult } from './types';
import { config } from '../config';
import { providerKeyStore } from './providerKeyStore';
import { buildExecutionPrompt } from './promptBuilder';
import { extractJsonFromText, validateOutputAgainstSchema } from '../validation/outputValidator';

export class GeminiAdapter implements AIProviderAdapter {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini';

  private readonly models: ModelInfo[] = [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash (Latest & Recommended)',
      contextWindow: 1048576,
      supportsVision: true,
      costPer1kInputTokens: 0.000075,
      costPer1kOutputTokens: 0.00030,
    },
    {
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash',
      contextWindow: 1048576,
      supportsVision: true,
      costPer1kInputTokens: 0.000075,
      costPer1kOutputTokens: 0.00030,
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      contextWindow: 1048576,
      supportsVision: true,
      costPer1kInputTokens: 0.000075,
      costPer1kOutputTokens: 0.00030,
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      contextWindow: 1048576,
      supportsVision: true,
      costPer1kInputTokens: 0.00010,
      costPer1kOutputTokens: 0.00040,
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      contextWindow: 2097152,
      supportsVision: true,
      costPer1kInputTokens: 0.00125,
      costPer1kOutputTokens: 0.0050,
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash (Legacy)',
      contextWindow: 1048576,
      supportsVision: true,
      costPer1kInputTokens: 0.000075,
      costPer1kOutputTokens: 0.00030,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro (Legacy)',
      contextWindow: 2097152,
      supportsVision: true,
      costPer1kInputTokens: 0.00125,
      costPer1kOutputTokens: 0.0050,
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

    // Default to gemini-3.8-flash; automatically map legacy models
    let activeModel = options.model || 'gemini-3.8-flash';
    if (activeModel === 'gemini-1.5-flash' || activeModel === 'gemini-2.5-flash') {
      activeModel = 'gemini-3.8-flash';
    }

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

    const keyPool = options.apiKeyOverride 
      ? [options.apiKeyOverride] 
      : providerKeyStore.getKeyPool(this.id);

    if (keyPool.length === 0) {
      throw new Error("Provider 'gemini' is not configured. Please supply a GEMINI_API_KEY.");
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || config.defaultExecutionTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let lastError: Error | null = null;
    let response: any = null;

    try {
      // Iterate through keys in the pool (provides automatic failover across multiple API keys)
      for (let kIndex = 0; kIndex < keyPool.length; kIndex++) {
        const currentKey = keyPool[kIndex];

        const tryCallGemini = async (modelToUse: string) => {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${currentKey}`;
          return await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': currentKey,
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          });
        };

        for (let attempt = 0; attempt < 2; attempt++) {
          let currentResponse = await tryCallGemini(activeModel);

          // Handle 404 (model deprecated/unsupported), 503 (high demand), 429 (rate limit)
          if (currentResponse.status === 404 || currentResponse.status === 503 || currentResponse.status === 429) {
            let suggestedModel: string | null = null;
            try {
              const errorText = await currentResponse.clone().text();
              const match = errorText.match(/models\/([a-zA-Z0-9\.\-_]+)/);
              if (match && match[1] && match[1] !== activeModel) {
                suggestedModel = match[1];
              }
            } catch {
              // ignore clone error
            }

            const candidates = [
              ...(suggestedModel ? [suggestedModel] : []),
              'gemini-3.8-flash',
              'gemini-3.5-flash',
              'gemini-2.5-flash',
              'gemini-2.0-flash',
            ];

            for (const candidate of candidates) {
              if (candidate === activeModel) continue;
              try {
                const fbRes = await tryCallGemini(candidate);
                if (fbRes.ok) {
                  currentResponse = fbRes;
                  activeModel = candidate;
                  break;
                }
              } catch {
                // continue trying candidates
              }
            }
          }

          if (currentResponse.ok) {
            response = currentResponse;
            break;
          }

          // If temporary spike (503) or rate limit (429), back off briefly on first attempt
          if ((currentResponse.status === 503 || currentResponse.status === 429) && attempt === 0) {
            await new Promise(r => setTimeout(r, 600));
            continue;
          }

          const errorBody = await currentResponse.text();
          lastError = new Error(`Gemini API returned HTTP ${currentResponse.status}: ${errorBody}`);
          break; // Try next key in pool
        }

        if (response && response.ok) {
          break;
        }
      }

      clearTimeout(timeoutId);

      if (!response || !response.ok) {
        throw lastError || new Error('Gemini API request failed across all keys and fallback models.');
      }

      const resJson: any = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const promptTokens = resJson.usageMetadata?.promptTokenCount || 0;
      const completionTokens = resJson.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = resJson.usageMetadata?.totalTokenCount || (promptTokens + completionTokens);

      const modelInfo = this.models.find(m => m.id === activeModel);
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
        model: activeModel,
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
