import { Router, Request, Response } from 'express';
import { ProviderRegistry } from '../providers/registry';
import { providerKeyStore } from '../providers/providerKeyStore';

export const providersRouter = Router();
const registry = ProviderRegistry.getInstance();

// List providers with configuration status and masked keys
providersRouter.get('/', (_req: Request, res: Response) => {
  try {
    const list = registry.list().map(p => ({
      ...p,
      isConfigured: providerKeyStore.isConfigured(p.id),
      maskedKey: providerKeyStore.getMaskedKey(p.id),
    }));
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Save or override API key for a provider
providersRouter.post('/:id/key', (req: Request, res: Response) => {
  try {
    const id = req.params.id.toLowerCase();
    const { apiKey } = req.body;

    if (!registry.has(id)) {
      return res.status(404).json({ success: false, error: { code: 'PROVIDER_NOT_FOUND', message: `Unknown provider '${id}'` } });
    }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_KEY', message: 'Valid non-empty apiKey string is required.' } });
    }

    providerKeyStore.setKey(id, apiKey);

    res.json({
      success: true,
      message: `API key for provider '${id}' updated successfully.`,
      data: {
        providerId: id,
        isConfigured: true,
        maskedKey: providerKeyStore.getMaskedKey(id),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Remove API key for a provider
providersRouter.delete('/:id/key', (req: Request, res: Response) => {
  try {
    const id = req.params.id.toLowerCase();
    if (!registry.has(id)) {
      return res.status(404).json({ success: false, error: { code: 'PROVIDER_NOT_FOUND', message: `Unknown provider '${id}'` } });
    }

    providerKeyStore.removeKey(id);
    res.json({
      success: true,
      message: `API key for provider '${id}' removed.`,
      data: {
        providerId: id,
        isConfigured: providerKeyStore.isConfigured(id),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
