import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiBaseUrl: string;
  frontendUrl: string;
  databasePath: string;
  adminSecretKey: string;
  maxRequestBodySizeMb: number;
  defaultExecutionTimeoutMs: number;
  providers: {
    openaiApiKey?: string;
    groqApiKey?: string;
    geminiApiKey?: string;
    anthropicApiKey?: string;
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data/hub.db'),
  adminSecretKey: process.env.ADMIN_SECRET_KEY || 'hub_admin_default_secret',
  maxRequestBodySizeMb: parseInt(process.env.MAX_REQUEST_BODY_SIZE_MB || '15', 10),
  defaultExecutionTimeoutMs: parseInt(process.env.DEFAULT_EXECUTION_TIMEOUT_MS || '30000', 10),
  providers: {
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    groqApiKey: process.env.GROQ_API_KEY || undefined,
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  },
};
