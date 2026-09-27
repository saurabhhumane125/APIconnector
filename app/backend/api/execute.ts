import { Router, Request, Response } from 'express';
import { ExecutionEngine } from '../connectors/executionEngine';

export const executionRouter = Router();
const executionEngine = ExecutionEngine.getInstance();

// Generated API endpoint by slug: POST /api/v1/run/:slug
executionRouter.post('/run/:slug', async (req: Request, res: Response) => {
  const slug = req.params.slug;
  const rawInputs = req.body || {};
  const authHeader = req.header('Authorization');
  const apiKeyHeader = req.header('X-API-Key');
  const clientIp = req.ip || req.socket.remoteAddress;

  const { statusCode, envelope } = await executionEngine.execute(slug, rawInputs, {
    authHeader,
    apiKeyHeader,
    clientIp,
  });

  res.status(statusCode).json(envelope);
});

// Generated API endpoint by ID: POST /api/v1/connectors/:id/execute
executionRouter.post('/connectors/:id/execute', async (req: Request, res: Response) => {
  const id = req.params.id;
  const rawInputs = req.body || {};
  const authHeader = req.header('Authorization');
  const apiKeyHeader = req.header('X-API-Key');
  const clientIp = req.ip || req.socket.remoteAddress;

  const { statusCode, envelope } = await executionEngine.execute(id, rawInputs, {
    authHeader,
    apiKeyHeader,
    clientIp,
  });

  res.status(statusCode).json(envelope);
});
