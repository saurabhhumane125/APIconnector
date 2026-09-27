# Universal AI API Hub — Deployment & Operations Guide

## 1. Environment Variables Configuration

Configure the following variables in your hosting environment (e.g. Render, Railway, Fly.io, Docker):

```ini
PORT=4000
NODE_ENV=production
API_BASE_URL=https://your-api-hub-domain.com
DATABASE_PATH=data/hub.db

# Master Admin Key
ADMIN_SECRET_KEY=generate_a_secure_random_key_here

# AI Provider API Keys (Server-side ONLY)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...

# Safe execution limits
MAX_REQUEST_BODY_SIZE_MB=15
DEFAULT_EXECUTION_TIMEOUT_MS=30000
```

---

## 2. Running Locally

### Development Mode
```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start backend and frontend concurrently
npm run dev
```

### Production Build & Single-Port Server
```bash
# Build frontend and compile backend verification
npm run build

# Start production server (serves API and built UI on port 4000)
npm start
```

---

## 3. Containerized Deployment (Docker)

```bash
# Build Docker image
docker build -t universal-ai-api-hub .

# Run with persistent SQLite volume
docker run -d \
  -p 4000:4000 \
  -v $(pwd)/data:/app/data \
  -e GROQ_API_KEY="gsk_..." \
  -e OPENAI_API_KEY="sk_..." \
  --name ai-hub \
  universal-ai-api-hub
```

Or using Docker Compose:
```bash
docker-compose up -d
```

---

## 4. Health Check & Observability Probes

The system provides a non-destructive health check probe:
```bash
curl -f http://localhost:4000/api/health
```

### Response
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-09-27T12:00:00.000Z",
  "uptime": 1245.3,
  "database": "connected",
  "providersConfigured": {
    "openai": true,
    "groq": true,
    "gemini": true,
    "anthropic": false
  },
  "version": "1.0.0"
}
```

---

## 5. Persistence & SQLite WAL Verification

The SQLite database file is stored at `data/hub.db`. SQLite WAL mode (`PRAGMA journal_mode = WAL`) is automatically enabled at startup.
All connector configurations, dynamically defined input parameters, SHA-256 hashed API keys, and execution telemetry logs survive application and server restarts.
