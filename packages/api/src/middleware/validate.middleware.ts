import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema, type ZodIssue } from 'zod';
import { ERROR_TYPES } from '@cyberguard/shared';

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.issues.map((issue: ZodIssue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json({
        type: ERROR_TYPES.BAD_REQUEST,
        title: 'Validation Error',
        status: 400,
        detail: 'One or more fields failed validation.',
        instance: req.path,
        errors: fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const fieldErrors = result.error.issues.map((issue: ZodIssue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json({
        type: ERROR_TYPES.BAD_REQUEST,
        title: 'Invalid Query Parameters',
        status: 400,
        detail: 'One or more query parameters are invalid.',
        instance: req.path,
        errors: fieldErrors,
      });
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidSchema = z.string().uuid('Invalid ID format');
