/**
 * CyberGuard AI — Organizations Router
 *
 * Mounted at /api/v1/organizations
 *
 * Sprint 1.4: POST / (create organization)
 *
 * @see Blueprint §4.2 — Multi-Tenancy
 */

import { Router, type Request, type Response } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { createOrganizationSchema } from './organizations.types';
import { createOrganizationForUser } from './organizations.service';
import { findOrganizationById } from '../../repositories/organizations.repository';
import { ERROR_TYPES } from '@cyberguard/shared';

export const organizationsRouter = Router();

// All organization routes require authentication
organizationsRouter.use(requireAuth);

// ─── POST / — Create organisation ────────────────────────────────────────────

organizationsRouter.post(
  '/',
  validate(createOrganizationSchema),
  async (req: Request, res: Response) => {
    try {
      // Prevent users who already have an org from creating another
      if (req.user!.organizationId) {
        res.status(409).json({
          type: ERROR_TYPES.BAD_REQUEST,
          title: 'Organisation Already Exists',
          status: 409,
          detail: 'You are already a member of an organisation.',
          instance: req.path,
        });
        return;
      }

      const organization = await createOrganizationForUser(req.user!.userId, req.body);
      res.status(201).json({ organization });
    } catch (err: any) {
      if (err.code === 'ORG_ALREADY_EXISTS') {
        res.status(409).json({
          type: ERROR_TYPES.BAD_REQUEST,
          title: 'Organisation Already Exists',
          status: 409,
          detail: 'You already own an organisation.',
          instance: req.path,
        });
        return;
      }
      throw err;
    }
  },
);

// ─── GET / — Get current user's organisation ─────────────────────────────────

organizationsRouter.get('/', async (req: Request, res: Response) => {
  if (!req.user!.organizationId) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND,
      title: 'No Organisation',
      status: 404,
      detail: 'You are not a member of any organisation yet.',
      instance: req.path,
    });
    return;
  }

  
    


  const organization = await findOrganizationById(req.user!.organizationId);

  if (!organization) {
    res.status(404).json({
      type: ERROR_TYPES.NOT_FOUND,
      title: 'Organisation Not Found',
      status: 404,
      detail: 'Your organisation could not be found.',
      instance: req.path,
    });
    return;
  }

  res.status(200).json({ organization });
});
