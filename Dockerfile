# Production Dockerfile for Universal AI API Hub
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools for native SQLite module compilation
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig*.json ./
RUN npm ci

COPY app ./app
COPY database ./database
COPY config ./config

# Build frontend and compile backend verification
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Final lightweight runner image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_PATH=/app/data/hub.db

RUN apk add --no-cache curl

# Copy runtime node_modules and built assets
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/app ./app
COPY --from=builder /app/database ./database
COPY --from=builder /app/config ./config
COPY --from=builder /app/dist ./dist

# Create persistent database directory
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD ["npm", "start"]
