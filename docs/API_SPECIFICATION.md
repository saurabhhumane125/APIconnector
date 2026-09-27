# Universal AI API Hub — API Specification

## 1. Generated Endpoint Conventions

Every connector configured on the platform exposes two canonical HTTP routes:
- **Slug Endpoint**: `POST /api/v1/run/:slug`
- **ID Endpoint**: `POST /api/v1/connectors/:id/execute`

### Request Headers
| Header | Type | Description |
| :--- | :--- | :--- |
| `Content-Type` | string | Must be `application/json` |
| `X-API-Key` | string | Required if connector authentication is set to `api_key` |
| `Authorization` | string | Format: `Bearer <token>` if authentication is set to `bearer_token` |

---

## 2. Standard Response Envelope

Every request returns a consistent, predictable envelope structure.

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "category": "technical",
    "priority": "high",
    "sentiment": "frustrated",
    "summary": "Customer reported 504 gateway timeout on login.",
    "suggested_action": "Escalate to Infrastructure On-Call.",
    "escalation_required": true
  },
  "error": null,
  "meta": {
    "requestId": "req_x8z19q_m3p1",
    "connectorId": "conn_support_triage_001",
    "connectorSlug": "support-ticket-triage",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "durationMs": 284,
    "tokens": {
      "prompt": 142,
      "completion": 38,
      "total": 180
    },
    "estimatedCost": 0.000113
  }
}
```

### Validation Error (`400 Bad Request`)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request input parameters.",
    "details": [
      {
        "field": "ticket_text",
        "message": "Required parameter 'ticket_text' is missing or empty",
        "expectedType": "text"
      }
    ]
  },
  "meta": {
    "requestId": "req_98b1a_k2n9",
    "connectorId": "conn_support_triage_001",
    "connectorSlug": "support-ticket-triage",
    "durationMs": 3
  }
}
```

### Unauthorized (`401 Unauthorized`)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key."
  },
  "meta": {
    "requestId": "req_f821a_p0m2",
    "durationMs": 2
  }
}
```

### Disabled Connector (`403 Forbidden`)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONNECTOR_DISABLED",
    "message": "This connector is currently disabled and not accepting requests."
  },
  "meta": {
    "requestId": "req_108bb_l1a2",
    "durationMs": 2
  }
}
```

### Upstream Provider Execution Error (`502 Bad Gateway`)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PROVIDER_EXECUTION_ERROR",
    "message": "Groq request timed out after 30000ms"
  },
  "meta": {
    "requestId": "req_abc12_98za",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "durationMs": 30002
  }
}
```

---

## 3. Supported Input Types & Payload Formats

| Type | Accepted JSON Formats | Example |
| :--- | :--- | :--- |
| `text` | string | `"Customer complaint text"` |
| `number` | number or numeric string | `42` or `19.99` |
| `boolean` | boolean or string (`"true"`, `"false"`) | `true` |
| `image` | base64 data URI (`data:image/png;base64,...`) or accessible HTTP URL | `"data:image/jpeg;base64,/9j/4AAQSkZ..."` |
| `file` | base64 string or plain text | `"data:text/plain;base64,..."` |
| `json` | JSON object or JSON array | `{"customerId": 101, "tier": "pro"}` |

---

## 4. Built-in Demonstration Connectors

### 1. Customer Support Ticket Triage (Text to Structured JSON)
- **Slug**: `support-ticket-triage`
- **Provider**: `groq` (Llama 3.3 70B)
- **Parameters**:
  - `ticket_text` (string, required): Full customer support message
  - `customer_tier` (string, optional, default: `"standard"`): `"standard"`, `"pro"`, `"enterprise"`
  - `urgency_score` (number, optional, default: `3`): 1 to 5

### 2. Receipt & Document OCR Extractor (Multimodal Image to Structured JSON)
- **Slug**: `receipt-ocr-extractor`
- **Provider**: `gemini` (Gemini 1.5 Flash)
- **Parameters**:
  - `receipt_image` (image, required): Base64 data URI or public image URL
  - `currency` (string, optional, default: `"USD"`): 3-letter currency code
  - `extract_notes` (boolean, optional, default: `false`): handwritten notes flag
