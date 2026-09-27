-- Migration 002: Seed default providers and demonstration connectors

-- 1. Default Providers
INSERT OR IGNORE INTO provider_settings (provider_id, name, enabled, default_model)
VALUES 
    ('groq', 'Groq LPU Acceleration', 1, 'llama-3.3-70b-versatile'),
    ('openai', 'OpenAI', 1, 'gpt-4o-mini'),
    ('gemini', 'Google Gemini', 1, 'gemini-1.5-flash'),
    ('anthropic', 'Anthropic Claude', 1, 'claude-3-5-sonnet-20241022');

-- 2. Connector 1: Customer Support Ticket Triage (Text to Structured JSON)
INSERT OR IGNORE INTO connectors (
    id, name, slug, description, provider, model, system_prompt, status, auth_type, output_schema, created_at, updated_at
) VALUES (
    'conn_support_triage_001',
    'Customer Support Ticket Triage',
    'support-ticket-triage',
    'Analyzes customer messages to extract category, urgency, sentiment, summary, and recommended response action.',
    'groq',
    'llama-3.3-70b-versatile',
    'You are an expert customer operations and ticket triage AI. Analyze the customer support ticket thoroughly and produce an accurate classification matching the requested JSON output schema exactly. Output ONLY valid JSON matching the schema.',
    'active',
    'none',
    '{"type":"object","required":["category","priority","sentiment","summary","suggested_action","escalation_required"],"properties":{"category":{"type":"string","enum":["billing","technical","account","feature_request","other"]},"priority":{"type":"string","enum":["low","medium","high","critical"]},"sentiment":{"type":"string","enum":["positive","neutral","frustrated","angry"]},"summary":{"type":"string"},"suggested_action":{"type":"string"},"escalation_required":{"type":"boolean"}}}',
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO input_parameters (id, connector_id, name, type, required, description, default_value, validation_rules, position)
VALUES 
    ('param_st_1', 'conn_support_triage_001', 'ticket_text', 'text', 1, 'Full customer message or ticket description', NULL, '{"min_length": 5}', 0),
    ('param_st_2', 'conn_support_triage_001', 'customer_tier', 'text', 0, 'Customer tier (standard, pro, enterprise)', 'standard', '{"allowed_values": ["standard", "pro", "enterprise"]}', 1),
    ('param_st_3', 'conn_support_triage_001', 'urgency_score', 'number', 0, 'Customer self-reported urgency from 1 (lowest) to 5 (highest)', '3', '{"min": 1, "max": 5}', 2);

-- 3. Connector 2: Receipt & Document OCR Extractor (Multimodal Image to Structured JSON)
INSERT OR IGNORE INTO connectors (
    id, name, slug, description, provider, model, system_prompt, status, auth_type, output_schema, created_at, updated_at
) VALUES (
    'conn_receipt_extractor_002',
    'Receipt & Document OCR Extractor',
    'receipt-ocr-extractor',
    'Performs visual analysis and structured extraction of receipt and invoice images into normalized JSON.',
    'gemini',
    'gemini-1.5-flash',
    'You are a high-precision financial document extraction AI. Inspect the provided receipt or invoice image, extract all key metadata, line items, and financial values. Output ONLY valid JSON matching the requested schema.',
    'active',
    'none',
    '{"type":"object","required":["merchant_name","date","currency","total_amount","tax_amount","category","line_items"],"properties":{"merchant_name":{"type":"string"},"date":{"type":"string"},"currency":{"type":"string"},"total_amount":{"type":"number"},"tax_amount":{"type":"number"},"category":{"type":"string"},"line_items":{"type":"array","items":{"type":"object","required":["description","amount"],"properties":{"description":{"type":"string"},"quantity":{"type":"number"},"amount":{"type":"number"}}}}}}',
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO input_parameters (id, connector_id, name, type, required, description, default_value, validation_rules, position)
VALUES 
    ('param_rc_1', 'conn_receipt_extractor_002', 'receipt_image', 'image', 1, 'Image of the receipt or invoice (Base64 data URI or public image URL)', NULL, '{"max_size_mb": 10}', 0),
    ('param_rc_2', 'conn_receipt_extractor_002', 'currency', 'text', 0, 'Expected ISO 4217 currency code (e.g. USD, EUR, INR)', 'USD', '{"min_length": 3, "max_length": 3}', 1),
    ('param_rc_3', 'conn_receipt_extractor_002', 'extract_notes', 'boolean', 0, 'Whether to extract handwritten or footer notes if present', 'false', NULL, 2);
