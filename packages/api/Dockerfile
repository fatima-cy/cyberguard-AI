# ── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy root configurations
COPY package*.json turbo.json tsconfig.json ./

# Copy packages
COPY packages/shared/package*.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/api/package*.json packages/api/tsconfig.json ./packages/api/

# Install all dependencies including devDependencies for compilation
RUN npm ci

# Copy source code
COPY packages/shared/src ./packages/shared/src
COPY packages/api/src ./packages/api/src

# Build packages using Turborepo
RUN npx turbo run build

# ── Production Runner Stage ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy root config
COPY package*.json ./

# Copy shared package
COPY --from=builder /usr/src/app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /usr/src/app/packages/shared/dist ./packages/shared/dist

# Copy api package
COPY --from=builder /usr/src/app/packages/api/package*.json ./packages/api/
COPY --from=builder /usr/src/app/packages/api/dist ./packages/api/dist

# Install production-only dependencies
RUN npm ci --omit=dev

# Run as a non-root user for security
USER node

EXPOSE 3000

CMD ["node", "packages/api/dist/app.js"]
