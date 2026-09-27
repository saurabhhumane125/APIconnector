export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  supportsVision: boolean;
  costPer1kInputTokens?: number;
  costPer1kOutputTokens?: number;
}

export interface InputParameterDef {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'image' | 'file' | 'json';
  required: boolean;
  description?: string;
  defaultValue?: string;
  validationRules?: Record<string, any>;
}

export interface ProviderExecutionOptions {
  model: string;
  systemPrompt: string;
  inputs: Record<string, any>;
  inputDefinitions: InputParameterDef[];
  outputSchema?: Record<string, any>;
  apiKeyOverride?: string;
  timeoutMs?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderExecutionResult {
  provider: string;
  model: string;
  rawText: string;
  data: any;
  tokens: TokenUsage;
  estimatedCost: number;
  durationMs: number;
}

export interface AIProviderAdapter {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getSupportedModels(): ModelInfo[];
  execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult>;
}
