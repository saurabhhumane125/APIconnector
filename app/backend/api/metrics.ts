import { Router, Request, Response } from 'express';
import { RequestLogger } from '../logging/requestLogger';

export const metricsRouter = Router();
const logger = RequestLogger.getInstance();

// Aggregate metrics
metricsRouter.get('/summary', (req: Request, res: Response) => {
  try {
    const connectorId = req.query.connectorId as string | undefined;
    const metrics = logger.getMetrics(connectorId);
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Detailed execution logs feed with filters
metricsRouter.get('/logs', (req: Request, res: Response) => {
  try {
    const connectorId = req.query.connectorId as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const logs = logger.getLogs({ connectorId, status, limit, offset });
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
