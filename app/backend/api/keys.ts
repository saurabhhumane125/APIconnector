import { Router, Request, Response } from 'express';
import { ApiKeyService } from '../auth/apiKeyService';

export const keysRouter = Router();
const apiKeyService = ApiKeyService.getInstance();

// List all registered API keys (prefixes only, never hashes or raw secrets)
keysRouter.get('/', (_req: Request, res: Response) => {
  try {
    const keys = apiKeyService.listKeys();
    res.json({ success: true, data: keys });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Generate new API key
keysRouter.post('/', (req: Request, res: Response) => {
  try {
    const { name, connectorId } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: "Key 'name' is required." },
      });
    }

    const result = apiKeyService.generateKey(name, connectorId);
    res.status(201).json({
      success: true,
      data: {
        record: result.record,
        secretKey: result.secretKey, // Returned ONLY once
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'KEY_CREATION_FAILED', message: err.message } });
  }
});

// Revoke API key
keysRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const revoked = apiKeyService.revokeKey(req.params.id);
    if (!revoked) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `API Key '${req.params.id}' not found.` },
      });
    }
    res.json({ success: true, message: 'API key revoked successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
