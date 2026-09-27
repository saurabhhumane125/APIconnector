import crypto from 'crypto';
import { getDatabase } from '../../../database/connection';

export interface ApiKeyRecord {
  id: string;
  connectorId: string | null;
  name: string;
  keyPrefix: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedApiKeyResult {
  record: ApiKeyRecord;
  secretKey: string; // Only returned once upon creation!
}

export class ApiKeyService {
  private static instance: ApiKeyService | null = null;

  public static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  public hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
  }

  public generateKey(name: string, connectorId?: string | null): CreatedApiKeyResult {
    const db = getDatabase();
    const id = `key_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const randomEntropy = crypto.randomBytes(24).toString('base64url');
    const secretKey = `hub_live_${randomEntropy}`;
    const keyPrefix = secretKey.substring(0, 16) + '...';
    const keyHash = this.hashKey(secretKey);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO api_keys (id, connector_id, name, key_prefix, key_hash, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(id, connectorId || null, name.trim(), keyPrefix, keyHash, now);

    const record: ApiKeyRecord = {
      id,
      connectorId: connectorId || null,
      name: name.trim(),
      keyPrefix,
      status: 'active',
      createdAt: now,
      lastUsedAt: null,
    };

    return { record, secretKey };
  }

  public verifyKey(rawKey: string, connectorId?: string): { valid: boolean; keyRecord?: ApiKeyRecord; reason?: string } {
    if (!rawKey || typeof rawKey !== 'string') {
      return { valid: false, reason: 'Missing API key' };
    }

    const keyHash = this.hashKey(rawKey);
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash) as any;

    if (!row) {
      return { valid: false, reason: 'Invalid API key' };
    }

    if (row.status !== 'active') {
      return { valid: false, reason: 'API key has been revoked' };
    }

    // Connector scoping check: if key is tied to a specific connector, it cannot call other connectors
    if (row.connector_id && connectorId && row.connector_id !== connectorId) {
      return { valid: false, reason: 'API key is not authorized for this specific connector' };
    }

    // Update last used timestamp
    const now = new Date().toISOString();
    try {
      db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now, row.id);
    } catch {
      // Non-blocking update failure
    }

    const keyRecord: ApiKeyRecord = {
      id: row.id,
      connectorId: row.connector_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      status: row.status,
      createdAt: row.created_at,
      lastUsedAt: now,
    };

    return { valid: true, keyRecord };
  }

  public listKeys(): ApiKeyRecord[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT id, connector_id, name, key_prefix, status, created_at, last_used_at FROM api_keys ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      connectorId: r.connector_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      status: r.status,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    }));
  }

  public revokeKey(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?").run(id);
    return res.changes > 0;
  }
}
