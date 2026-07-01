/**
 * CyberGuard AI — Redis Client
 *
 * Azure Managed Redis (redisEnterprise) connects on port 10000 over TLS.
 * In local development, falls back to REDIS_CONNECTION_STRING if
 * REDIS_ENDPOINT is not set.
 *
 * Sprint 1 usage: rate limiting token per user, refresh token blocklist.
 * Sprint 2+ usage: session caching, feature flag cache, response cache.
 *
 * @see Blueprint §8.3 — Caching Strategy
 * @see Sprint 0 Phase B — Redis Enterprise provisioned (port 10000, TLS)
 */

import Redis from 'ioredis';
import { config } from './env';
import { logger } from '../core/observability/logger';

// ─── Determine connection parameters ─────────────────────────────────────────

function createRedisClient(): Redis {
  const endpoint = config.azure.endpoints.redis;
  const connectionString = config.azure.fallbacks.redisConnectionString;

  if (endpoint) {
    // Azure Managed Redis — endpoint format: <name>.redis.azure.net
    // Port 10000, TLS required, access key from Key Vault secret
    const [host, portStr] = endpoint.includes(':')
      ? endpoint.split(':')
      : [endpoint, '10000'];

    const port = parseInt(portStr, 10);

    // Access key injected at runtime via Key Vault reference in App Settings
    const accessKey = process.env.REDIS_ACCESS_KEY;

    return new Redis({
      host,
      port,
      password: accessKey,
      tls: {},                    // TLS required for Azure Managed Redis
      retryStrategy: (times) => {
        if (times > 5) {
          logger.warn('Redis retry limit exceeded — operating without cache');
          return null;            // Stop retrying, app continues without Redis
        }
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,          // Don't connect until first command
    });
  }

  if (connectionString) {
    // Local development connection string fallback
    return new Redis(connectionString, {
      retryStrategy: (times) => (times > 3 ? null : times * 100),
      lazyConnect: true,
    });
  }

  // No Redis config — return a no-op stub that logs warnings
  // This allows the app to start without Redis in early dev
  logger.warn(
    'No Redis configuration found (REDIS_ENDPOINT or REDIS_CONNECTION_STRING). ' +
    'Redis-dependent features (rate limiting per user, token blocklist) will be unavailable.',
  );

  // Return a minimal stub that satisfies the Redis interface for non-critical paths
  return new Redis({ lazyConnect: true, enableOfflineQueue: false });
}

export const redis = createRedisClient();

// ─── Connection event logging ─────────────────────────────────────────────────

redis.on('connect', () => {
  logger.info('Redis connected', {
    host: config.azure.endpoints.redis ?? 'local',
  });
});

redis.on('error', (err: Error) => {
  // Log as warn not error — Redis is non-critical; app continues without it
  logger.warn('Redis connection error', { error: err.message });
});

redis.on('close', () => {
  logger.info('Redis connection closed');
});

// ─── Health check helper ──────────────────────────────────────────────────────

export async function checkRedisHealth(): Promise<'ok' | 'unavailable'> {
  try {
    const result = await redis.ping();
    return result === 'PONG' ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
