import { useAzureMonitor } from '@azure/monitor-opentelemetry';
import { trace, propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function initTelemetry(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (connectionString) {
    useAzureMonitor({
      azureMonitorExporterOptions: {
        connectionString,
      },
      samplingRatio: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      enableStandardMetrics: true,
    });
  }

  // W3C TraceContext propagation
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  const span = trace.getActiveSpan();
  
  if (span) {
    span.setAttribute('http.request_id', requestId);
    // Cast req to any to read custom fields safely
    const customReq = req as any;
    span.setAttribute('organization.id', customReq.organizationId ?? 'unknown');
    span.setAttribute('user.id', customReq.userId ?? 'anonymous');
  }
  
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Trace-ID', span?.spanContext().traceId ?? '');
  
  // Also set on req object so handlers can log it
  (req as any).requestId = requestId;
  (req as any).traceId = span?.spanContext().traceId ?? '';
  
  next();
}
