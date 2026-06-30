/**
 * Unit tests — Health Endpoint
 *
 * These tests verify the health endpoint behaviour without any external
 * dependencies (no Cosmos DB, Redis, or Azure services required).
 *
 * Test IDs follow the Blueprint convention: TI-XX for tenant isolation,
 * US-XX for user stories. Health tests are tagged HC-XX (Health Check).
 *
 * @see Blueprint §4.2 — Dashboard Module (health as first signal)
 * @see Sprint 0 v1.1 §9 — Health Endpoint Specification
 */
import request from 'supertest';
import app from '../../src/app';

describe('Health Endpoint', () => {
  // ── GET /health (App Service probe path) ─────────────────────────────────
  describe('GET /health', () => {
    it('HC-01: returns 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });

    it('HC-02: returns status "healthy"', async () => {
      const res = await request(app).get('/health');
      expect(res.body.status).toBe('healthy');
    });

    it('HC-03: returns the expected message', async () => {
      const res = await request(app).get('/health');
      expect(res.body.message).toBe('CyberGuard AI API Running');
    });
  });

  // ── GET /api/v1/health (versioned API path) ───────────────────────────────
  describe('GET /api/v1/health', () => {
    it('HC-04: returns 200 OK on versioned path', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
    });

    it('HC-05: returns expected JSON shape', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.body).toMatchObject({
        status: 'healthy',
        message: 'CyberGuard AI API Running',
        version: expect.any(String) as string,
        environment: expect.any(String) as string,
        timestamp: expect.any(String) as string,
        checks: {
          api: 'ok',
        },
      });
    });

    it('HC-06: returns a valid ISO 8601 timestamp', async () => {
      const res = await request(app).get('/api/v1/health');
      const ts = new Date(res.body.timestamp as string);
      expect(isNaN(ts.getTime())).toBe(false);
    });

    it('HC-07: sets Cache-Control: no-store', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('HC-08: sets X-Request-ID response header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('HC-09: sets X-Trace-ID response header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-trace-id']).toBeDefined();
    });

    it('HC-10: propagates client-supplied X-Request-ID', async () => {
      const clientRequestId = 'test-request-id-12345';
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Request-ID', clientRequestId);
      expect(res.headers['x-request-id']).toBe(clientRequestId);
    });
  });

  // ── Phase 2-4 module stubs ────────────────────────────────────────────────
  describe('Module stubs (Phase 2-4)', () => {
    it('HC-11: /api/v1/academy returns 503 (Phase 2 stub)', async () => {
      const res = await request(app).get('/api/v1/academy');
      expect(res.status).toBe(503);
      expect(res.body.type).toBe('/errors/module-not-available');
    });

    it('HC-12: /api/v1/sarah returns 503 (Phase 3 stub)', async () => {
      const res = await request(app).get('/api/v1/sarah');
      expect(res.status).toBe(503);
    });

    it('HC-13: /api/v1/ecocold returns 503 (Phase 4 stub)', async () => {
      const res = await request(app).get('/api/v1/ecocold');
      expect(res.status).toBe(503);
    });
  });

  // ── 404 handling ─────────────────────────────────────────────────────────
  describe('404 handling', () => {
    it('HC-14: unknown routes return 404 with RFC 7807 body', async () => {
      const res = await request(app).get('/api/v1/this-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        type: '/errors/not-found',
        title: 'Not Found',
        status: 404,
      });
    });

    it('HC-15: completely unknown path returns 404', async () => {
      const res = await request(app).get('/completely/unknown/path');
      expect(res.status).toBe(404);
    });
  });

  // ── Security headers ──────────────────────────────────────────────────────
  describe('Security headers (Helmet)', () => {
    it('HC-16: response includes X-Content-Type-Options: nosniff', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('HC-17: response includes X-Frame-Options', async () => {
      const res = await request(app).get('/health');
      // Helmet sets this to SAMEORIGIN or DENY
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });
});
