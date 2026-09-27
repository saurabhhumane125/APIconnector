import { Router, Request, Response } from 'express';
import { ProviderRegistry } from '../providers/registry';

export const providersRouter = Router();
const registry = ProviderRegistry.getInstance();

providersRouter.get('/', (_req: Request, res: Response) => {
  try {
    const list = registry.list();
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
