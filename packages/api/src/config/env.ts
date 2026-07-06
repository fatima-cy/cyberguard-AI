/**
 * CyberGuard AI — Centralised Environment Configuration
 *
 * Single source of truth for all runtime configuration.
 * Validated at startup; missing required values throw immediately
 * rather than surfacing as obscure runtime errors later.
 *
 * @see Blueprint §7.2 — Configuration Management
 * @see Sprint 1.1 — JWT + OpenAI deployment config added
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root first, then fall back to cwd
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[config] Missing required environment variable: ${key}. ` +
      `Ensure it is set in .env or the deployment environment.`,
    );
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// ─── Configuration object ─────────────────────────────────────────────────────

export const config = {
  app: {
    nodeEnv,
    isProduction,
    isTest: nodeEnv === 'test',
    isDevelopment: nodeEnv === 'development',
    port: parseInt(optional('APP_PORT', '3000'), 10),
    version: optional('APP_VERSION', '0.1.0'),
    logLevel: optional('LOG_LEVEL', isProduction ? 'info' : 'debug'),
    corsAllowedOrigins: optional(
      'CORS_ALLOWED_ORIGINS',
      'http://localhost:5173,http://localhost:3000',
    )
      .split(',')
      .map(origin => origin.trim()),
  },

  // ─── JWT ───────────────────────────────────────────────────────────────────
  // JWT_SECRET must be at least 32 characters in production.
  // In development/test a default is accepted for local convenience.
  jwt: {
    secret: isProduction
      ? required('JWT_SECRET')
      : optional('JWT_SECRET', 'dev-secret-change-me-in-production-min-32-chars'),
    accessExpiry: optional('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: optional('JWT_REFRESH_EXPIRY', '7d'),
    refreshCookieName: 'refreshToken',
    refreshCookieOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
      path: '/api/v1/auth',        // Scope refresh cookie to auth routes only
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    },
  },

  // ─── Azure ─────────────────────────────────────────────────────────────────
  azure: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    tenantId: process.env.AZURE_TENANT_ID,

    endpoints: {
      cosmos: process.env.COSMOS_ENDPOINT,
      redis: process.env.REDIS_ENDPOINT,
      serviceBus: process.env.SERVICEBUS_NAMESPACE,
      openai: process.env.OPENAI_ENDPOINT,
      aiSearch: process.env.AISEARCH_ENDPOINT,
      blob: process.env.BLOB_ENDPOINT,
      keyVault: process.env.KEYVAULT_URI,
      appConfig: process.env.APP_CONFIG_ENDPOINT,
    },

    fallbacks: {
      cosmosConnectionString: process.env.COSMOS_CONNECTION_STRING,
      cosmosDatabaseName: optional('COSMOS_DATABASE_NAME', 'cloudsecure_platform'),
      redisConnectionString: process.env.REDIS_CONNECTION_STRING,
      blobConnectionString: process.env.BLOB_CONNECTION_STRING,
      serviceBusConnectionString: process.env.SERVICEBUS_CONNECTION_STRING,
      openaiApiKey: process.env.OPENAI_API_KEY,
      aiSearchApiKey: process.env.AISEARCH_API_KEY,
    },
  },

  // ─── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    deploymentName: optional('OPENAI_DEPLOYMENT_NAME', 'gpt-4o-mini'),
    embeddingDeployment: optional('OPENAI_EMBEDDING_DEPLOYMENT', 'text-embedding-3-large'),
    maxTokens: parseInt(optional('OPENAI_MAX_TOKENS', '2048'), 10),
  },
};

// ─── Startup validation log ───────────────────────────────────────────────────
// Logs which auth strategy is active so it's visible on startup
if (!config.app.isTest) {
  const cosmosStrategy = config.azure.endpoints.cosmos
    ? 'Managed Identity'
    : 'Connection String (fallback)';
  const openaiStrategy = config.azure.endpoints.openai
    ? 'Managed Identity'
    : 'API Key (fallback)';

  // These are printed by the logger after it initialises — the config module
  // itself stays pure and doesn't import logger to avoid circular deps.
  process.env.__COSMOS_STRATEGY__ = cosmosStrategy;
  process.env.__OPENAI_STRATEGY__ = openaiStrategy;
}
