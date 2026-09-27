# Universal AI API Connector & API Hub

A production-grade, multi-provider platform that enables administrators to configure reusable AI-powered API connectors, automatically exposing live HTTP endpoints, dynamic parameter validation, structured JSON outputs, and persistent telemetry.

Built according to the **Universal AI API Hub — Antigravity Master Build Specification (v1.0)**.

---

## Key Capabilities

- **Decoupled Provider Adapter Architecture**: Extensible adapters for **Groq**, **OpenAI**, **Google Gemini**, and **Anthropic Claude**. Core connector logic contains zero provider-specific branching.
- **Dynamic Input Parameter System**: Authoritative schema-driven validation supporting all 6 mandatory types: `text`, `number`, `boolean`, `image`, `file`, and `json`.
- **Expected Structured Output Contract**: Guarantees predictable JSON outputs validated against configurable JSON Schemas inside a standard `{ success, data, error, meta }` response envelope.
- **Generated HTTP API Endpoints**: Generates real endpoints accessible by slug (`POST /api/v1/run/:slug`) or ID (`POST /api/v1/connectors/:id/execute`).
- **Live Automatic Documentation**: Derived directly from authoritative database configuration with copyable cURL snippets and schema specs.
- **Dynamic Test API Interface**: Renders form controls dynamically based on parameter definitions, supporting image upload preview, JSON editors, and live response inspection.
- **Persistent Request Logging & Telemetry**: Every execution is recorded in SQLite (WAL mode enabled), tracking durations, token counts, estimated costs, provider/model, and errors.
- **API Key Security**: Access control with SHA-256 hashed storage, per-connector scoping, and server-side secret isolation.

---

## Built-In Demonstration Connectors

1. **Customer Support Ticket Triage** (`/api/v1/run/support-ticket-triage`)
   - **Type**: Text-to-Structured-JSON
   - **Provider / Model**: Groq / `llama-3.3-70b-versatile`
   - **Output**: Categorization, priority, sentiment, and recommended action.

2. **Receipt & Document OCR Extractor** (`/api/v1/run/receipt-ocr-extractor`)
   - **Type**: Multimodal Image-to-Structured-JSON
   - **Provider / Model**: Google Gemini / `gemini-1.5-flash`
   - **Output**: Merchant, date, line items, and total amount.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (copy example)
cp .env.example .env

# 3. Apply database migrations
npm run db:migrate

# 4. Run automated test suite (24 unit, integration, and E2E tests)
npm test

# 5. Start development servers (Backend + Vite Frontend)
npm run dev
```

Visit the dashboard at `http://localhost:5173` (development) or `http://localhost:4000` (production).

---

## Testing & Verification

```bash
npm test
```
Runs 24 automated tests covering:
- **Phase 1**: SQLite connection, WAL mode, schema migrations.
- **Phase 2**: Provider registry, adapters, prompt formatting, output validation.
- **Phase 3 & 4**: Connector CRUD, unique slugs, dynamic input parameter validation.
- **Phase 5-9**: Endpoints, authentication, documentation generation, and persistent logging.
- **Phase 11-13**: End-to-end execution lifecycle and error handling.
