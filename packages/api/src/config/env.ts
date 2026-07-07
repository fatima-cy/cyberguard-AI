/**
 * CyberGuard AI — Centralised Environment Configuration
 * Sprint 2.5: Added ACS (email) and APP_BASE_URL config blocks
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`[config] Missing required environment variable: ${key}.`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  app: {
    nodeEnv,
    isProduction,
    isTest: nodeEnv === 'test',
    isDevelopment: nodeEnv === 'development',
    port: parseInt(optional('APP_PORT', '3000'), 10),
    version: optional('APP_VERSION', '0.1.0'),
    logLevel: optional('LOG_LEVEL', isProduction ? 'info' : 'debug'),
    baseUrl: optional('APP_BASE_URL', 'http://localhost:5173'),
    corsAllowedOrigins: optional(
      'CORS_ALLOWED_ORIGINS',
      'http://localhost:5173,http://localhost:3000',
    ).split(',').map(o => o.trim()),
  },

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
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  },

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

  openai: {
    deploymentName: optional('OPENAI_DEPLOYMENT_NAME', 'gpt-4o-mini'),
    embeddingDeployment: optional('OPENAI_EMBEDDING_DEPLOYMENT', 'text-embedding-3-large'),
    maxTokens: parseInt(optional('OPENAI_MAX_TOKENS', '2048'), 10),
  },

  // ─── Azure Communication Services ────────────────────────────────────────
  acs: {
    connectionString: process.env.ACS_CONNECTION_STRING,
    senderAddress: optional(
      'ACS_SENDER_ADDRESS',
      'DoNotReply@0e729d44-7739-497e-979a-1993cf7116c7.azurecomm.net',
    ),
  },
};

if (!config.app.isTest) {
  const cosmosStrategy = config.azure.endpoints.cosmos ? 'Managed Identity' : 'Connection String (fallback)';
  const openaiStrategy = config.azure.endpoints.openai ? 'Managed Identity' : 'API Key (fallback)';
  process.env.__COSMOS_STRATEGY__ = cosmosStrategy;
  process.env.__OPENAI_STRATEGY__ = openaiStrategy;
}
