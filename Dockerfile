# Amebo — Multi-stage Dockerfile for Dokploy
# Builds the Next.js web app from the Turborepo monorepo

# ── Stage 1: Install dependencies ──
FROM node:18-alpine AS deps
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

RUN npm install --legacy-peer-deps

# ── Stage 2: Build ──
FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Build the web app
RUN npx turbo run build --filter=@notetaker/web

# ── Stage 3: Production runner ──
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy built output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
