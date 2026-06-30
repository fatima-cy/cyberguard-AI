import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or packages/api folder
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // fallback to current working directory .env

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const config = {
  app: {
    nodeEnv,
    port: parseInt(process.env.APP_PORT ?? '3000', 10),
    version: process.env.APP_VERSION ?? '0.1.0',
    logLevel: process.env.LOG_LEVEL ?? 'debug',
    corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:3000')
      .split(',')
      .map(origin => origin.trim()),
    isTest: nodeEnv === 'test',
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
      aiLanguage: process.env.AILANGUAGE_ENDPOINT,
      blob: process.env.BLOB_ENDPOINT,
      keyVault: process.env.KEYVAULT_URI,
      appConfig: process.env.APP_CONFIG_ENDPOINT,
    },
    fallbacks: {
      cosmosConnectionString: process.env.COSMOS_CONNECTION_STRING,
      cosmosDatabaseName: process.env.COSMOS_DATABASE_NAME ?? 'cloudsecure_platform',
      redisConnectionString: process.env.REDIS_CONNECTION_STRING,
      blobConnectionString: process.env.BLOB_CONNECTION_STRING,
      serviceBusConnectionString: process.env.SERVICEBUS_CONNECTION_STRING,
      openaiApiKey: process.env.OPENAI_API_KEY,
      aiSearchApiKey: process.env.AISEARCH_API_KEY,
      aiLanguageApiKey: process.env.AILANGUAGE_API_KEY,
    }
  }
};
