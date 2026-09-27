-- Migration 001: Initial Schema for Universal AI API Hub

CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'disabled')) DEFAULT 'active',
    auth_type TEXT NOT NULL CHECK(auth_type IN ('none', 'api_key', 'bearer_token')) DEFAULT 'none',
    output_schema TEXT NOT NULL, -- JSON Schema representation of expected output
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_connectors_slug ON connectors(slug);
CREATE INDEX IF NOT EXISTS idx_connectors_status ON connectors(status);

CREATE TABLE IF NOT EXISTS input_parameters (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('text', 'number', 'boolean', 'image', 'file', 'json')),
    required INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    default_value TEXT,
    validation_rules TEXT, -- JSON string containing min, max, regex, mime_types, etc.
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_input_parameters_connector ON input_parameters(connector_id, position);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    connector_id TEXT, -- NULL means universal access to any connector
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL, -- First 8 characters shown to user, e.g. "hub_live_a1b2..."
    key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of full API key
    status TEXT NOT NULL CHECK(status IN ('active', 'revoked')) DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_connector ON api_keys(connector_id);

CREATE TABLE IF NOT EXISTS api_request_logs (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL CHECK(status IN ('success', 'error')),
    http_status INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    input_payload TEXT,
    response_payload TEXT,
    error_code TEXT,
    error_message TEXT,
    client_ip TEXT,
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_request_logs_connector ON api_request_logs(connector_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON api_request_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_request_logs_status ON api_request_logs(status);

CREATE TABLE IF NOT EXISTS provider_settings (
    provider_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    api_key_override TEXT, -- Optional server-managed custom key
    default_model TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
