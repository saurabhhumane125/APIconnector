import { getDatabase } from '../../../database/connection';

export interface LogEntry {
  connectorId: string;
  status: 'success' | 'error';
  httpStatus: number;
  durationMs: number;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  inputPayload?: Record<string, any>;
  responsePayload?: any;
  errorCode?: string;
  errorMessage?: string;
  clientIp?: string;
}

export interface HubMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRatePercentage: number;
  avgDurationMs: number;
  p95DurationMs: number;
  totalTokens: number;
  totalEstimatedCost: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
  providerBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
}

export class RequestLogger {
  private static instance: RequestLogger | null = null;

  public static getInstance(): RequestLogger {
    if (!RequestLogger.instance) {
      RequestLogger.instance = new RequestLogger();
    }
    return RequestLogger.instance;
  }

  public log(entry: LogEntry): string {
    const id = `log_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    try {
      const db = getDatabase();
      const now = new Date().toISOString();

      // Sanitize and safely truncate payload if very large (e.g. huge images)
      let inputSerialized = '';
      if (entry.inputPayload) {
        const sanitized: Record<string, any> = { ...entry.inputPayload };
        for (const [k, v] of Object.entries(sanitized)) {
          if (typeof v === 'string' && v.startsWith('data:image/')) {
            sanitized[k] = `[base64 image payload: ${v.substring(0, 30)}... (${v.length} bytes)]`;
          }
        }
        inputSerialized = JSON.stringify(sanitized).substring(0, 8000);
      }

      const responseSerialized = entry.responsePayload
        ? JSON.stringify(entry.responsePayload).substring(0, 8000)
        : null;

      db.prepare(`
        INSERT INTO api_request_logs (
          id, connector_id, timestamp, status, http_status, duration_ms,
          provider, model, prompt_tokens, completion_tokens, total_tokens,
          estimated_cost, input_payload, response_payload, error_code, error_message, client_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        entry.connectorId,
        now,
        entry.status,
        entry.httpStatus,
        entry.durationMs,
        entry.provider,
        entry.model,
        entry.promptTokens || 0,
        entry.completionTokens || 0,
        entry.totalTokens || 0,
        entry.estimatedCost || 0.0,
        inputSerialized || null,
        responseSerialized,
        entry.errorCode || null,
        entry.errorMessage || null,
        entry.clientIp || null
      );
    } catch (err) {
      // Non-blocking: Logging failure MUST NOT crash the main request execution path
      console.error('[RequestLogger] Safe failure recording log entry:', err);
    }
    return id;
  }

  public getMetrics(connectorId?: string): HubMetrics {
    const db = getDatabase();
    const whereClause = connectorId ? 'WHERE connector_id = ?' : '';
    const params = connectorId ? [connectorId] : [];

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(duration_ms) as avg_duration,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        MIN(timestamp) as first_use,
        MAX(timestamp) as last_use
      FROM api_request_logs
      ${whereClause}
    `).get(...params) as any;

    const total = stats?.total || 0;
    const successCount = stats?.success_count || 0;
    const errorCount = stats?.error_count || 0;
    const rate = total > 0 ? (successCount / total) * 100 : 100;

    // Calculate P95 latency
    let p95Duration = 0;
    if (total > 0) {
      const p95Index = Math.floor(total * 0.95);
      const row = db.prepare(`
        SELECT duration_ms FROM api_request_logs
        ${whereClause}
        ORDER BY duration_ms ASC
        LIMIT 1 OFFSET ?
      `).get(...(connectorId ? [connectorId, p95Index] : [p95Index])) as any;
      p95Duration = row?.duration_ms || Math.round(stats?.avg_duration || 0);
    }

    // Provider and model breakdowns
    const providerRows = db.prepare(`
      SELECT provider, COUNT(*) as count FROM api_request_logs
      ${whereClause}
      GROUP BY provider
    `).all(...params) as any[];

    const modelRows = db.prepare(`
      SELECT model, COUNT(*) as count FROM api_request_logs
      ${whereClause}
      GROUP BY model
    `).all(...params) as any[];

    const providerBreakdown: Record<string, number> = {};
    for (const r of providerRows) providerBreakdown[r.provider] = r.count;

    const modelBreakdown: Record<string, number> = {};
    for (const r of modelRows) modelBreakdown[r.model] = r.count;

    return {
      totalRequests: total,
      successfulRequests: successCount,
      failedRequests: errorCount,
      successRatePercentage: Number(rate.toFixed(1)),
      avgDurationMs: Math.round(stats?.avg_duration || 0),
      p95DurationMs: p95Duration,
      totalTokens: stats?.total_tokens || 0,
      totalEstimatedCost: Number((stats?.total_cost || 0).toFixed(6)),
      firstUsedAt: stats?.first_use || null,
      lastUsedAt: stats?.last_use || null,
      providerBreakdown,
      modelBreakdown,
    };
  }

  public getLogs(options?: { connectorId?: string; status?: string; limit?: number; offset?: number }) {
    const db = getDatabase();
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.connectorId) {
      conditions.push('l.connector_id = ?');
      params.push(options.connectorId);
    }
    if (options?.status) {
      conditions.push('l.status = ?');
      params.push(options.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    return db.prepare(`
      SELECT 
        l.*,
        c.name as connector_name,
        c.slug as connector_slug
      FROM api_request_logs l
      LEFT JOIN connectors c ON l.connector_id = c.id
      ${where}
      ORDER BY l.timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...params);
  }
}
