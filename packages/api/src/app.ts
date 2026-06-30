/**
 * CyberGuard AI — Express Application
 *
 * IMPORTANT: initTelemetry() is called FIRST before any other imports.
 * OpenTelemetry must be initialised before the Azure SDKs are loaded
 * so that all SDK calls are auto-instrumented.
 *
 * Application startup sequence:
 *   1. Initialise OTel (must be first)
 *   2. Configure Express security middleware
 *   3. Mount versioned API router (/api/v1)
 *   4. Register health endpoint (on both /health and /api/v1/health)
 *   5. Register 404 and global error handlers
 *
 * @see Blueprint §7.6 — API Architecture (/api/v1 versioning)
 * @see Blueprint §6.14 — AI Telemetry (OTel first-import requirement)
 * @see Sprint 0 v1.1 §18 — API Versioning Strategy
 */

// ─── Step 1: OTel MUST be first ──────────────────────────────────────────────
import { initTelemetry } from './core/observability/telemetry';
initTelemetry();

// ─── Step 2: All other imports ───────────────────────────────────────────────
import express, { Router, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { correlationMiddleware } from './core/observability/telemetry';
import { logger } from './core/observability/logger';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';

// ─── Application instance ────────────────────────────────────────────────────
const app = express();

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
    crossOriginEmbedderPolicy: false, // Required for Azure Static Web Apps integration
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (health checks, Postman, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (config.app.corsAllowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' is not permitted`));
      }
    },
    credentials: true, // Required for HttpOnly refresh-token cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-Trace-ID'],
  }),
);

// Parse JSON bodies — 1MB limit prevents large-payload DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ─── Correlation middleware (inject X-Request-ID on every request) ───────────
app.use(correlationMiddleware);

// ─── Rate limiting — general API limiter (per-feature limits added in Sprint 1)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60,             // 60 requests per minute per IP (dev/staging default)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: '/errors/rate-limit-exceeded',
    title: 'Too Many Requests',
    status: 429,
    detail: 'You have exceeded the request rate limit. Please try again in a moment.',
  },
  skip: () => config.app.isTest, // Never rate-limit during automated testing
});
app.use('/api/', generalLimiter);

// ─── Health endpoint (on two paths) ──────────────────────────────────────────
// Path 1: /health — for Azure App Service health check probe
// Path 2: /api/v1/health — for versioned API health checks and CI smoke tests
// Both return identical responses.
// In Sprint 1, this response will include dependency health checks:
// { cosmos: 'ok', redis: 'ok', servicebus: 'ok' }
function healthHandler(_req: Request, res: Response): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const traceId = (_req as Request & { traceId: string }).traceId ?? 'not-available';
  const requestId = (_req as Request & { requestId: string }).requestId ?? 'not-available';

  res.status(200).json({
    status: 'healthy',
    message: 'CyberGuard AI API Running',
    version: config.app.version,
    environment: config.app.nodeEnv,
    timestamp: new Date().toISOString(),
    requestId,
    traceId,
    checks: {
      api: 'ok',
      // Sprint 1 will add:
      // cosmos: 'ok' | 'degraded' | 'unavailable',
      // redis:  'ok' | 'degraded' | 'unavailable',
    },
  });
}

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// ─── Versioned API Router (/api/v1) ──────────────────────────────────────────
const v1Router = Router();

// Phase 2-4 module stubs — return 503 until feature flag enables the module.
// These stubs ensure the router is wired correctly before any module is built.
const moduleNotAvailableHandler = (_req: Request, res: Response): void => {
  res.status(503).json({
    type: '/errors/module-not-available',
    title: 'Module Not Available',
    status: 503,
    detail: 'This module is not yet available. It will be enabled in a future release.',
    instance: _req.path,
  });
};

v1Router.use('/academy', moduleNotAvailableHandler);   // Phase 2
v1Router.use('/sarah', moduleNotAvailableHandler);     // Phase 3
v1Router.use('/ecocold', moduleNotAvailableHandler);   // Phase 4

// Sprint 1+ modules will be mounted here:
// v1Router.use('/auth',          authRouter);
// v1Router.use('/users',         usersRouter);
// v1Router.use('/organizations', organizationsRouter);
// v1Router.use('/subscriptions', subscriptionsRouter);
// v1Router.use('/billing',       billingRouter);
// v1Router.use('/notifications', notificationsRouter);
// v1Router.use('/metering',      meteringRouter);
// v1Router.use('/knowledge',     knowledgeRouter);
// v1Router.use('/cyberguard',    cyberguardRouter);
// v1Router.use('/dashboard',     dashboardRouter);
// v1Router.use('/analytics',     analyticsRouter);
// v1Router.use('/audit-logs',    auditLogsRouter);
// v1Router.use('/feature-flags', featureFlagsRouter);
// v1Router.use('/admin',         adminRouter);

app.use('/api/v1', v1Router);

// ─── 404 and global error handlers (must be last) ────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Server startup (only when run directly, not when imported by tests) ─────
if (require.main === module) {
  const port = config.app.port;
  app.listen(port, () => {
    logger.info('CyberGuard AI API started', {
      port,
      version: config.app.version,
      environment: config.app.nodeEnv,
      health: `http://localhost:${port}/health`,
    });
  });
}

export default app;
