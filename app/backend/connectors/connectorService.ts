import { getDatabase } from '../../../database/connection';
import { Connector, ConnectorInputParameter, ConnectorStatus, CreateConnectorDTO, UpdateConnectorDTO } from './types';
import { ProviderRegistry } from '../providers/registry';

export class ConnectorService {
  private static instance: ConnectorService | null = null;

  public static getInstance(): ConnectorService {
    if (!ConnectorService.instance) {
      ConnectorService.instance = new ConnectorService();
    }
    return ConnectorService.instance;
  }

  public listConnectors(): Connector[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM connectors ORDER BY created_at DESC').all() as any[];
    return rows.map(r => this.hydrateConnector(r));
  }

  public getConnectorById(id: string): Connector | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM connectors WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.hydrateConnector(row);
  }

  public getConnectorBySlug(slug: string): Connector | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM connectors WHERE slug = ?').get(slug) as any;
    if (!row) return null;
    return this.hydrateConnector(row);
  }

  public createConnector(dto: CreateConnectorDTO): Connector {
    const db = getDatabase();
    const registry = ProviderRegistry.getInstance();

    if (!dto.name || dto.name.trim().length === 0) {
      throw new Error("Connector 'name' is required.");
    }
    if (!dto.provider || !registry.has(dto.provider)) {
      throw new Error(`Invalid or unsupported provider: '${dto.provider}'.`);
    }
    if (!dto.model || dto.model.trim().length === 0) {
      throw new Error("Connector 'model' is required.");
    }
    if (!dto.systemPrompt || dto.systemPrompt.trim().length === 0) {
      throw new Error("Connector 'systemPrompt' is required.");
    }
    if (!dto.outputSchema || typeof dto.outputSchema !== 'object') {
      throw new Error("Connector 'outputSchema' must be a valid JSON Schema object.");
    }

    const id = `conn_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const slug = this.generateUniqueSlug(dto.slug || dto.name);
    const status = dto.status || 'active';
    const authType = dto.authType || 'none';
    const now = new Date().toISOString();

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO connectors (
          id, name, slug, description, provider, model, system_prompt, status, auth_type, output_schema, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        dto.name.trim(),
        slug,
        dto.description || '',
        dto.provider.toLowerCase().trim(),
        dto.model.trim(),
        dto.systemPrompt.trim(),
        status,
        authType,
        JSON.stringify(dto.outputSchema),
        now,
        now
      );

      if (Array.isArray(dto.inputParameters)) {
        const insertParam = db.prepare(`
          INSERT INTO input_parameters (
            id, connector_id, name, type, required, description, default_value, validation_rules, position
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        dto.inputParameters.forEach((param, index) => {
          const paramId = `param_${Math.random().toString(36).substring(2, 9)}`;
          insertParam.run(
            paramId,
            id,
            param.name.trim(),
            param.type,
            param.required ? 1 : 0,
            param.description || null,
            param.defaultValue || null,
            param.validationRules ? JSON.stringify(param.validationRules) : null,
            index
          );
        });
      }
    });

    insertTx();
    const created = this.getConnectorById(id);
    if (!created) throw new Error('Failed to retrieve newly created connector');
    return created;
  }

  public updateConnector(id: string, dto: UpdateConnectorDTO): Connector {
    const existing = this.getConnectorById(id);
    if (!existing) {
      throw new Error(`Connector with ID '${id}' not found.`);
    }

    const db = getDatabase();
    const registry = ProviderRegistry.getInstance();

    if (dto.provider && !registry.has(dto.provider)) {
      throw new Error(`Invalid or unsupported provider: '${dto.provider}'.`);
    }

    const now = new Date().toISOString();
    const name = dto.name !== undefined ? dto.name.trim() : existing.name;
    const description = dto.description !== undefined ? dto.description : existing.description;
    const provider = dto.provider !== undefined ? dto.provider.toLowerCase().trim() : existing.provider;
    const model = dto.model !== undefined ? dto.model.trim() : existing.model;
    const systemPrompt = dto.systemPrompt !== undefined ? dto.systemPrompt.trim() : existing.systemPrompt;
    const status = dto.status !== undefined ? dto.status : existing.status;
    const authType = dto.authType !== undefined ? dto.authType : existing.authType;
    const outputSchema = dto.outputSchema !== undefined ? JSON.stringify(dto.outputSchema) : JSON.stringify(existing.outputSchema);

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = this.generateUniqueSlug(dto.slug, id);
    }

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE connectors SET
          name = ?, slug = ?, description = ?, provider = ?, model = ?,
          system_prompt = ?, status = ?, auth_type = ?, output_schema = ?, updated_at = ?
        WHERE id = ?
      `).run(
        name, slug, description, provider, model,
        systemPrompt, status, authType, outputSchema, now, id
      );

      if (Array.isArray(dto.inputParameters)) {
        db.prepare('DELETE FROM input_parameters WHERE connector_id = ?').run(id);

        const insertParam = db.prepare(`
          INSERT INTO input_parameters (
            id, connector_id, name, type, required, description, default_value, validation_rules, position
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        dto.inputParameters.forEach((param, index) => {
          const paramId = `param_${Math.random().toString(36).substring(2, 9)}`;
          insertParam.run(
            paramId,
            id,
            param.name.trim(),
            param.type,
            param.required ? 1 : 0,
            param.description || null,
            param.defaultValue || null,
            param.validationRules ? JSON.stringify(param.validationRules) : null,
            index
          );
        });
      }
    });

    updateTx();
    return this.getConnectorById(id)!;
  }

  public toggleConnectorStatus(id: string, status: ConnectorStatus): Connector {
    const existing = this.getConnectorById(id);
    if (!existing) {
      throw new Error(`Connector with ID '${id}' not found.`);
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare('UPDATE connectors SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    return this.getConnectorById(id)!;
  }

  public deleteConnector(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare('DELETE FROM connectors WHERE id = ?').run(id);
    return res.changes > 0;
  }

  private generateUniqueSlug(base: string, excludeId?: string): string {
    const db = getDatabase();
    let slug = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) slug = 'connector';

    let currentCandidate = slug;
    let counter = 1;

    while (true) {
      const existing = excludeId
        ? db.prepare('SELECT id FROM connectors WHERE slug = ? AND id != ?').get(currentCandidate, excludeId)
        : db.prepare('SELECT id FROM connectors WHERE slug = ?').get(currentCandidate);

      if (!existing) return currentCandidate;
      currentCandidate = `${slug}-${counter}`;
      counter++;
    }
  }

  private hydrateConnector(row: any): Connector {
    const db = getDatabase();
    const paramRows = db
      .prepare('SELECT * FROM input_parameters WHERE connector_id = ? ORDER BY position ASC')
      .all(row.id) as any[];

    const inputParameters: ConnectorInputParameter[] = paramRows.map(p => ({
      id: p.id,
      connectorId: p.connector_id,
      name: p.name,
      type: p.type,
      required: Boolean(p.required),
      description: p.description || undefined,
      defaultValue: p.default_value || undefined,
      validationRules: p.validation_rules ? JSON.parse(p.validation_rules) : undefined,
      position: p.position,
    }));

    let outputSchema: Record<string, any> = {};
    try {
      outputSchema = JSON.parse(row.output_schema || '{}');
    } catch {
      outputSchema = {};
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || '',
      provider: row.provider,
      model: row.model,
      systemPrompt: row.system_prompt,
      status: row.status as ConnectorStatus,
      authType: row.auth_type as any,
      outputSchema,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      inputParameters,
    };
  }
}
