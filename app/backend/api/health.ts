import { Request, Response } from 'express';
import { getDatabase } from '../../../database/connection';
import { config } from '../config';
import { providerKeyStore } from '../providers/providerKeyStore';

export function healthHandler(_req: Request, res: Response): void {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
    const dbHealthy = row?.alive === 1;

    // Check configured provider status (only indicating presence of keys, never exposing raw secrets)
    const providerStatus = {
      openai: providerKeyStore.isConfigured('openai'),
      groq: providerKeyStore.isConfigured('groq'),
      gemini: providerKeyStore.isConfigured('gemini'),
      anthropic: providerKeyStore.isConfigured('anthropic'),
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
