import { Router, Request, Response } from 'express';
import { ConnectorService } from '../connectors/connectorService';
import { generateConnectorDocumentation } from '../docs/docGenerator';

export const connectorRouter = Router();
const connectorService = ConnectorService.getInstance();

// List all connectors
connectorRouter.get('/', (_req: Request, res: Response) => {
  try {
    const connectors = connectorService.listConnectors();
    res.json({ success: true, data: connectors });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Get connector by ID
connectorRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const connector = connectorService.getConnectorById(req.params.id);
    if (!connector) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Connector '${req.params.id}' not found.` },
      });
    }
    res.json({ success: true, data: connector });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Get generated API documentation for a connector
connectorRouter.get('/:id/docs', (req: Request, res: Response) => {
  try {
    const connector = connectorService.getConnectorById(req.params.id);
    if (!connector) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Connector '${req.params.id}' not found.` },
      });
    }
    const host = `${req.protocol}://${req.get('host')}`;
    const docs = generateConnectorDocumentation(connector, host);
    res.json({ success: true, data: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Create new connector
connectorRouter.post('/', (req: Request, res: Response) => {
  try {
    const created = connectorService.createConnector(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'INVALID_CONFIG', message: err.message } });
  }
});

// Update existing connector
connectorRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const updated = connectorService.updateConnector(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
  }
});

// Toggle status (active/disabled)
connectorRouter.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (status !== 'active' && status !== 'disabled') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: "Status must be 'active' or 'disabled'." },
      });
    }
    const updated = connectorService.toggleConnectorStatus(req.params.id, status);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
  }
});

// Delete connector
connectorRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = connectorService.deleteConnector(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Connector '${req.params.id}' not found.` },
      });
    }
    res.json({ success: true, message: 'Connector successfully deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
