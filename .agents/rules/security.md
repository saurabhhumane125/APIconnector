# Security and Secrets Protection Rules

1. NEVER commit or push `.env` or any environment secret files.
2. NEVER commit database binaries (`data/`, `*.db`, `*.sqlite`, `*.db-wal`).
3. NEVER commit private keys, certificates, or tokens (`*.pem`, `*.key`, `*.cert`).
4. Ensure `.env.example` contains only empty string placeholders and never real credentials.
5. All AI provider keys and master administrative secrets must strictly remain server-side and never be exposed in client code, logs, or public responses.
