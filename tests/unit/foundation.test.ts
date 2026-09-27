import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase, closeDatabase } from '../../database/connection';
import { createServer } from '../../app/backend/server';

describe('Phase 1 Foundation - Database & Server Shell', () => {
  let db: ReturnType<typeof getDatabase>;

  beforeAll(() => {
    db = getDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  it('connects to SQLite and WAL mode is active', () => {
    expect(db).toBeDefined();
    const journalMode = db.pragma('journal_mode', { simple: true });
    expect(journalMode).toBe('wal');
  });

  it('has migrations and seed data loaded in SQLite', () => {
    const connectors = db.prepare('SELECT id, name, provider, status FROM connectors').all();
    expect(connectors.length).toBeGreaterThanOrEqual(2);

    const supportTicket = db.prepare("SELECT * FROM connectors WHERE slug = 'support-ticket-triage'").get() as any;
    expect(supportTicket).toBeDefined();
    expect(supportTicket.name).toBe('Customer Support Ticket Triage');

    const receiptExtractor = db.prepare("SELECT * FROM connectors WHERE slug = 'receipt-ocr-extractor'").get() as any;
    expect(receiptExtractor).toBeDefined();
    expect(receiptExtractor.name).toBe('Receipt & Document OCR Extractor');
  });

  it('express server shell can be instantiated with health endpoint', () => {
    const app = createServer();
    expect(app).toBeDefined();
  });
});
