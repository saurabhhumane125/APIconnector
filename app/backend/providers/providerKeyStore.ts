import { getDatabase } from '../../../database/connection';
import { config } from '../config';

class ProviderKeyStore {
  private static instance: ProviderKeyStore | null = null;
  private memoryCache: Map<string, string> = new Map();

  public static getInstance(): ProviderKeyStore {
    if (!ProviderKeyStore.instance) {
      ProviderKeyStore.instance = new ProviderKeyStore();
    }
    return ProviderKeyStore.instance;
  }

  public getKey(providerId: string): string | undefined {
    const id = providerId.toLowerCase();

    // 1. Check in-memory override
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id);
    }

    // 2. Check database provider_settings
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT api_key_override FROM provider_settings WHERE provider_id = ?').get(id) as any;
      if (row?.api_key_override) {
        this.memoryCache.set(id, row.api_key_override);
        return row.api_key_override;
      }
    } catch {
      // Fallback
    }

    // 3. Fallback to process.env config
    if (id === 'gemini') return config.providers.geminiApiKey;
    if (id === 'openai') return config.providers.openaiApiKey;
    if (id === 'groq') return config.providers.groqApiKey;
    if (id === 'anthropic') return config.providers.anthropicApiKey;

    return undefined;
  }

  public setKey(providerId: string, apiKey: string): void {
    const id = providerId.toLowerCase().trim();
    const cleanKey = apiKey.trim();

    this.memoryCache.set(id, cleanKey);

    // Persist to database
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO provider_settings (provider_id, name, enabled, api_key_override, default_model, updated_at)
        VALUES (?, ?, 1, ?, ?, datetime('now'))
        ON CONFLICT(provider_id) DO UPDATE SET
          api_key_override = excluded.api_key_override,
          updated_at = datetime('now')
      `).run(id, id.toUpperCase(), cleanKey, 'default');
    } catch (err) {
      console.error('[ProviderKeyStore] Failed to persist key to DB:', err);
    }
  }

  public removeKey(providerId: string): void {
    const id = providerId.toLowerCase();
    this.memoryCache.delete(id);
    try {
      const db = getDatabase();
      db.prepare("UPDATE provider_settings SET api_key_override = NULL, updated_at = datetime('now') WHERE provider_id = ?").run(id);
    } catch (err) {
      console.error('[ProviderKeyStore] Failed to remove key from DB:', err);
    }
  }

  public isConfigured(providerId: string): boolean {
    return this.getKeyPool(providerId).length > 0;
  }

  public getKeyPool(providerId: string): string[] {
    const raw = this.getKey(providerId);
    if (!raw) return [];
    return raw
      .split(/[\n,;]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
  }

  public getMaskedKey(providerId: string): string | null {
    const keys = this.getKeyPool(providerId);
    if (keys.length === 0) return null;
    const maskSingle = (k: string) => k.length <= 8 ? '****' : `${k.substring(0, 4)}...${k.substring(k.length - 4)}`;
    if (keys.length === 1) {
      return maskSingle(keys[0]);
    }
    return `${keys.length} keys pooled (${maskSingle(keys[0])}, ...)`;
  }
}

export const providerKeyStore = ProviderKeyStore.getInstance();
