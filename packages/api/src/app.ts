/**
 * CyberGuard AI — Express Application
 *
 * Application startup sequence:
 *   1. Initialise OTel (must be first — before any Azure SDK imports)
 *   2. Security middleware (helmet, cors, body parsing)
 *   3. Correlation + request logging middleware
 *   4. Rate limiting
 *   5. Health endpoints (/health, /health/cosmos, /health/ai, /api/v1/health)
 *   6. Versioned API router (/api/v1)
 *   7. 404 and global error handlers (must be last)
 *
 * @see Blueprint §7.6 — API Architecture (/api/v1 versioning)
 * @see Blueprint §6.14 — AI Telemetry
 * @see Sprint 1.1 — Enhanced health endpoints, request logger added
 */

// ─── Step 1: OTel MUST be first ──────────────────────────────────────────────
import { initTelemetry } from './core/observability/telemetry';
initTelemetry();

// ─── Step 2: All other imports ───────────────────────────────────────────────
import express, { Router, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Sprint 4.6 — express-rate-limit@7.5.1 (installed here) validates its
// default rate-limit key strictly as a bare IPv4/IPv6 address and throws
// (ERR_ERL_INVALID_IP_ADDRESS) on anything else. Cloudflare, sitting in
// front of the custom domain, occasionally forwards a client IP with a
// port suffix attached (e.g. "98.97.76.0:8764" or "[::1]:8080") rather
// than a bare address — this strips that suffix so the limiter gets a
// clean key. (The library's own ipKeyGenerator helper that does this
// isn't available until v8+, so this is a local equivalent.)
function normalizeIpForRateLimit(ip: string): string {
  const bracketed = ip.match(/^\[(.+)\]:\d+$/);
  if (bracketed) return bracketed[1];
  const ipv4WithPort = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/);
  if (ipv4WithPort) return ipv4WithPort[1];
  return ip;
}
import { config } from './config/env';
import { correlationMiddleware } from './core/observability/telemetry';
import { logger } from './core/observability/logger';
import { requestLogger } from './middleware/requestLogger.middleware';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';
import { container } from './config/db';
import { checkRedisHealth } from './config/redis';

// ─── Application instance ────────────────────────────────────────────────────
const app = express();

// Sprint 4.6 — Azure App Service sits the app behind exactly one reverse
// proxy hop (the platform's own front-end), which sets X-Forwarded-For.
// Without telling Express to trust it, express-rate-limit can't reliably
// determine the real client IP (this was surfacing as
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR in logs) — in the worst case that
// means the rate limiter either can't distinguish clients at all, or can
// be bypassed by a spoofed header. `1` trusts exactly the immediate proxy
// hop, not an unbounded chain — `true` would trust X-Forwarded-For from
// anywhere, which is the actual security risk this exists to avoid.
app.set('trust proxy', 1);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) { callback(null, true); return; }
      if (config.app.corsAllowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' is not permitted`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-Trace-ID'],
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// ─── Correlation + request logging ───────────────────────────────────────────
app.use(correlationMiddleware);
app.use(requestLogger);

// ─── Rate limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: '/errors/rate-limit-exceeded',
    title: 'Too Many Requests',
    status: 429,
    detail: 'You have exceeded the request rate limit. Please try again in a moment.',
  },
  skip: () => config.app.isTest,
  // Sprint 4.6 — the custom domain now sits behind Cloudflare, which
  // occasionally forwards a client IP with a port suffix attached (e.g.
  // "98.97.76.0:8764") rather than a bare IP. express-rate-limit's default
  // key generator validates req.ip strictly as IPv4/IPv6 and throws on
  // anything else (ERR_ERL_INVALID_IP_ADDRESS), crashing the request. Their
  // own ipKeyGenerator helper normalizes this correctly instead of relying
  // on the raw value.
  keyGenerator: (req) => normalizeIpForRateLimit(req.ip ?? 'unknown'),
});
app.use('/api/', generalLimiter);

// ─── Health endpoints ─────────────────────────────────────────────────────────
// /health             — Azure App Service probe (fast, no dependencies)
// /health/cosmos      — Cosmos DB connectivity check
// /health/ai          — OpenAI endpoint reachability check
// /api/v1/health      — Versioned alias (returns same as /health + dependency status)

async function basicHealthHandler(_req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'healthy',
    version: config.app.version,
    environment: config.app.nodeEnv,
    timestamp: new Date().toISOString(),
  });
}

async function fullHealthHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  const traceId = (req as any).traceId ?? 'not-available';
  const requestId = (req as any).requestId ?? 'not-available';

  // Run dependency checks in parallel with a timeout
  const timeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), ms),
      ),
    ]).catch(() => fallback);

  const [cosmosStatus, redisStatus] = await Promise.all([
    timeout(checkCosmosHealth(), 3000, 'unavailable' as const),
    timeout(checkRedisHealth(), 2000, 'unavailable' as const),
  ]);

  const allHealthy = cosmosStatus === 'ok';
  const status = allHealthy ? 'healthy' : 'degraded';

  res.status(allHealthy ? 200 : 207).json({
    status,
    version: config.app.version,
    environment: config.app.nodeEnv,
    timestamp: new Date().toISOString(),
    requestId,
    traceId,
    checks: {
      api: 'ok',
      cosmos: cosmosStatus,
      redis: redisStatus,
    },
  });
}

async function cosmosHealthHandler(_req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const status = await checkCosmosHealth();
    res.status(status === 'ok' ? 200 : 503).json({ status, timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unavailable', timestamp: new Date().toISOString() });
  }
}

async function aiHealthHandler(_req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  // Lightweight check — verifies the OpenAI endpoint is configured and reachable
  const endpoint = config.azure.endpoints.openai ?? 'not-configured';
  const configured = endpoint !== 'not-configured';
  res.status(configured ? 200 : 503).json({
    status: configured ? 'ok' : 'not-configured',
    endpoint: configured ? endpoint.replace(/\/\/.*@/, '//<redacted>@') : 'not-configured',
    deployment: config.openai.deploymentName,
    timestamp: new Date().toISOString(),
  });
}

// Register health routes
app.get('/health', basicHealthHandler);
app.get('/health/cosmos', cosmosHealthHandler);
app.get('/health/ai', aiHealthHandler);

// ─── Versioned API Router (/api/v1) ──────────────────────────────────────────
const v1Router = Router();

// Full health check on the versioned path
v1Router.get('/health', fullHealthHandler);

// Phase 2-4 module stubs
const moduleNotAvailableHandler = (_req: Request, res: Response): void => {
  res.status(503).json({
    type: '/errors/module-not-available',
    title: 'Module Not Available',
    status: 503,
    detail: 'This module is not yet available. It will be enabled in a future release.',
    instance: _req.path,
  });
};

v1Router.use('/academy', moduleNotAvailableHandler);
v1Router.use('/sarah', moduleNotAvailableHandler);
v1Router.use('/ecocold', moduleNotAvailableHandler);

// Sprint 1.2: Auth router mounted
import { authRouter } from './modules/auth/auth.router';
v1Router.use('/auth', authRouter);

// Sprint 1.4: Organizations router mounted
import { organizationsRouter } from './modules/organizations/organizations.router';
import { invitationsRouter } from './modules/invitations/invitations.router';
v1Router.use('/organizations', organizationsRouter);
v1Router.use('/invitations', invitationsRouter);

// Sprint 1.5: CyberGuard AI chat router mounted
import { cyberguardRouter } from './modules/cyberguard/cyberguard.router';
import { phishingRouter } from './modules/phishing/phishing.router';
import { policiesRouter } from './modules/policies/policies.router';
v1Router.use('/cyberguard', cyberguardRouter);
v1Router.use('/phishing', phishingRouter);
v1Router.use('/policies', policiesRouter);
import { dashboardRouter } from './modules/dashboard/dashboard.router';
v1Router.use('/dashboard', dashboardRouter);
// v1Router.use('/cyberguard',    cyberguardRouter);

app.use('/api/v1', v1Router);

// ─── 404 and global error handlers (must be last) ────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Server startup ───────────────────────────────────────────────────────────
if (require.main === module) {
  const port = config.app.port;
  app.listen(port, () => {
    logger.info('CyberGuard AI API started', {
      port,
      version: config.app.version,
      environment: config.app.nodeEnv,
      cosmosStrategy: process.env.__COSMOS_STRATEGY__,
      openaiStrategy: process.env.__OPENAI_STRATEGY__,
      health: `http://localhost:${port}/health`,
    });
  });
}

// ─── Cosmos health check helper ───────────────────────────────────────────────
async function checkCosmosHealth(): Promise<'ok' | 'unavailable'> {
  try {
    // Lightweight operation — reads database properties, doesn't scan data
    const usersContainer = container('users');
    await usersContainer.read();
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

export default app;
