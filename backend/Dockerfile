# Hyperfi Voice & TTS Streaming Engine - Production Dockerfile
# Optimized for Google Cloud Run, AWS ECS Fargate, and single-host VPS deployments.

FROM node:22-alpine AS build
WORKDIR /app

# Install native compilation dependencies required by better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS production
WORKDIR /app

# Install ffmpeg for audio post-processing and curl for fast container health checks
RUN apk add --no-cache ffmpeg curl

# Create persistent data & cache directories and assign secure ownership to non-root node user
RUN mkdir -p /data/cache /app/cache && chown -R node:node /data /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Switch to least-privilege non-root execution (uid 1000:1000)
USER node

ENV NODE_ENV=production
ENV PORT=4000
ENV DATA_DIR=/data
ENV TRUST_PROXY=1

# Expose standard production port
EXPOSE 4000

# Fast health check probe for Cloud Run, ECS load balancer, and Docker Compose orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health/live || exit 1

CMD ["node", "src/index.js"]
