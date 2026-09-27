import { Request, Response } from 'express';
import { getDatabase } from '../../../database/connection';
import { config } from '../config';

export function healthHandler(_req: Request, res: Response): void {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
    const dbHealthy = row?.alive === 1;

    // Check configured provider status (only indicating presence of keys, never exposing raw secrets)
    const providerStatus = {
      openai: Boolean(config.providers.openaiApiKey),
      groq: Boolean(config.providers.groqApiKey),
      gemini: Boolean(config.providers.geminiApiKey),
      anthropic: Boolean(config.providers.anthropicApiKey),
    };

    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'degraded',
      providersConfigured: providerStatus,
      version: '1.0.0'
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Database connection or core subsystem unavailable',
      }
    });
  }
}
