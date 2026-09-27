import { AIProviderAdapter, ModelInfo } from './types';
import { GroqAdapter } from './groq';
import { OpenAIAdapter } from './openai';
import { GeminiAdapter } from './gemini';
import { AnthropicAdapter } from './anthropic';

export interface ProviderSummary {
  id: string;
  name: string;
  isConfigured: boolean;
  supportedModels: ModelInfo[];
}

export class ProviderRegistry {
  private static instance: ProviderRegistry | null = null;
  private adapters: Map<string, AIProviderAdapter> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  private registerDefaults(): void {
    this.register(new GroqAdapter());
    this.register(new OpenAIAdapter());
    this.register(new GeminiAdapter());
    this.register(new AnthropicAdapter());
  }

  public register(adapter: AIProviderAdapter): void {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  public get(id: string): AIProviderAdapter {
    const adapter = this.adapters.get(id.toLowerCase());
    if (!adapter) {
      throw new Error(`AI Provider '${id}' is not recognized or not supported.`);
    }
    return adapter;
  }

  public has(id: string): boolean {
    return this.adapters.has(id.toLowerCase());
  }

  public list(): ProviderSummary[] {
    return Array.from(this.adapters.values()).map(adapter => ({
      id: adapter.id,
      name: adapter.name,
      isConfigured: adapter.isConfigured(),
      supportedModels: adapter.getSupportedModels(),
    }));
  }
}
