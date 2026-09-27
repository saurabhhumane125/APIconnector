# Universal AI API Hub — Architecture Documentation

## 1. System Overview

The **Universal AI API Hub** is a production-grade developer platform that dynamically transforms arbitrary AI provider capabilities into standardized, schema-validated, persistent HTTP API endpoints.

Instead of writing custom backend glue code and hand-crafted provider integrations for each AI use case, developers configure reusable **Connectors**. Once configured, the platform automatically:
1. Exposes real runtime HTTP endpoints (`/api/v1/run/:slug` and `/api/v1/connectors/:id/execute`).
2. Enforces access control (Public, API Key, Bearer Token) via SHA-256 hashed credentials.
3. Dynamically validates request inputs against typed parameter definitions.
4. Invokes the configured provider through a decoupled provider-adapter architecture.
5. Forces and validates structured JSON output conforming to the connector's JSON schema.
6. Records complete operational telemetry (duration, tokens, estimated costs, HTTP codes, sanitized payloads) in persistent SQLite storage.
7. Generates live, interactive API documentation with copyable cURL snippets.

---

## 2. Core Architecture & Layers

```
External HTTP Clients / UI Dashboard
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Express HTTP Server & Security Boundary                │
│  - CORS & Header Policy                                │
│  - Payload Size Limits (15MB for Multimodal)          │
│  - Request Timing & ID Tagging                         │
└────────────────────────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ API Routing Layer                                      │
│  - /api/connectors       (CRUD, Status Toggling)       │
│  - /api/v1/run/:slug     (Generated Endpoints)         │
│  - /api/keys             (API Key Management)          │
│  - /api/metrics          (Telemetry & Aggregate Stats) │
│  - /api/providers        (Provider & Model Directory)  │
│  - /api/health           (Readiness & Liveness Probe)  │
└────────────────────────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Authoritative Execution Engine                         │
│  1. Connector Lookup (by Slug or ID)                   │
│  2. Status Check (Active vs Disabled rejection)        │
│  3. Authentication Verification (SHA-256 Key Match)    │
│  4. Dynamic Input Parameter Validation & Type Coercion │
│  5. Provider Registry Dispatch                         │
│  6. Structured Output Normalization & JSON Validation  │
│  7. Persistent Request Logging & Telemetry Recording   │
│  8. Standard Envelope Response Formatting              │
└────────────────────────────────────────────────────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
┌──────────────────┐  ┌───────────────────────────────────┐
│ Provider Adapter │  │ SQLite Persistence (WAL Mode)     │
│ Architecture     │  │  - connectors                     │
│  - OpenAIAdapter │  │  - input_parameters               │
│  - GroqAdapter   │  │  - api_keys (Hashed)              │
│  - GeminiAdapter │  │  - api_request_logs               │
│  - Anthropic...  │  │  - provider_settings              │
└──────────────────┘  └───────────────────────────────────┘
```

---

## 3. Decoupled Provider Adapter Pattern

The connector engine contains **no provider-specific branching logic**. All provider specifics are isolated behind a common `AIProviderAdapter` interface:

```typescript
export interface AIProviderAdapter {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getSupportedModels(): ModelInfo[];
  execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult>;
}
```

### Supported Adapters:
- **GroqAdapter**: High-speed inference using LPU acceleration with native JSON mode and exact cost calculations.
- **OpenAIAdapter**: Support for GPT-4o, GPT-4o-mini, multimodal vision payloads, and structured output formatting.
- **GeminiAdapter**: Google Gemini 1.5 Flash / Pro supporting text, inline base64 multimodal vision, and native schema enforcement.
- **AnthropicAdapter**: Claude 3.5 Sonnet / Haiku supporting multimodal image inputs, system instructions, and token usage tracking.

---

## 4. Authoritative Dynamic Validation Layer

Client requests are validated against the connector's persisted parameter definitions:
- **Supported Parameter Types**: `text`, `number`, `boolean`, `image`, `file`, `json`.
- **Validation Rules**: Minimum/maximum numeric ranges, string length constraints, regex matching, allowed enum values, and file size limits.
- **Default Values**: Automatically coerced and injected when optional parameters are omitted.
- **Rejection Policy**: Invalid or missing required fields are rejected with HTTP 400 before invoking any AI provider.

---

## 5. Security & Isolation Standard

- **Server-Side API Keys**: Provider keys are loaded from environment variables and never exposed to the frontend, client responses, or logs.
- **Client API Keys**: Client access credentials use the `hub_live_...` prefix and are stored as one-way **SHA-256 hashes**.
- **Scope Restriction**: API keys can be globally scoped or restricted strictly to a single connector ID.
- **Safe Payload Logging**: Large base64 image strings are sanitized before persisting to request logs to prevent database bloat.
- **Failure Isolation**: Upstream provider errors, timeouts, and validation failures return structured JSON envelopes without leaking internal stack traces.
