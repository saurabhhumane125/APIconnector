import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { healthHandler } from './api/health';
import { connectorRouter } from './api/connectors';
import { executionRouter } from './api/execute';
import { keysRouter } from './api/keys';
import { metricsRouter } from './api/metrics';
import { providersRouter } from './api/providers';

export function createServer() {
  const app = express();

  // Basic security and deliberate CORS policy
  app.use(cors({
    origin: '*', // Allows dashboard and external API clients
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept'],
    exposedHeaders: ['X-Request-Id', 'X-Response-Time'],
  }));

  // Body parsing with safe size limits for multimodal base64 image payloads
  const payloadLimit = `${config.maxRequestBodySizeMb}mb`;
  app.use(express.json({ limit: payloadLimit }));
  app.use(express.urlencoded({ extended: true, limit: payloadLimit }));

  // Request timing and ID tagging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = `req_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      if (!res.headersSent) {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', `${duration}ms`);
      }
      return originalEnd.apply(this, args as any);
    };

    next();
  });


  // Health and system status
  app.get('/api/health', healthHandler);

  // Mount API routers
  app.use('/api/connectors', connectorRouter);
  app.use('/api/v1', executionRouter);
  app.use('/api/keys', keysRouter);
  app.use('/api/metrics', metricsRouter);
  app.use('/api/providers', providersRouter);

  // Serve static frontend assets in production / single-server mode
  const staticPath = path.resolve(process.cwd(), 'dist/frontend');
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Don't intercept /api routes
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }

  // 404 Handler for API routes adhering to predictable response envelope
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      data: null,
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: `The requested API path '${req.method} ${req.path}' does not exist on this server.`,
      },
    });
  });


  // Global Error Handler adhering to predictable response envelope (never exposing raw stack traces)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Universal AI API Hub] Internal error caught:', err);
    res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred while processing the request.',
      },
    });
  });

  return app;
}
