import { Router, Response } from 'express';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  listClients,
  getClientProfile,
  getClientAppointments,
  updateClientInfo,
  blockClient,
  unblockClient,
  toggleVip,
} from '../../../application/use-cases/clients/index.js';

const router = Router();

// GET /api/v1/manage/clients - List clients
router.get(
  '/',
  requirePermission('clients:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { segment, page = '1', limit = '20' } = req.query;
    const result = await listClients({
      businessId: req.currentBusiness!.businessId,
      segment: segment as string | undefined,
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 50),
    });
    res.json({ success: true, data: result });
  })
);

// GET /api/v1/manage/clients/:id - Get client details
router.get(
  '/:id',
  requirePermission('clients:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getClientProfile({
      clientRelationId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, data: result });
  })
);

// PUT /api/v1/manage/clients/:id - Update client info
router.put(
  '/:id',
  requirePermission('clients:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { tags, notes, allergies, preferences } = req.body;
    const result = await updateClientInfo({
      clientRelationId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      tags,
      notes,
      allergies,
      preferences,
    });
    res.json({ success: true, data: result });
  })
);

// GET /api/v1/manage/clients/:id/appointments - Get client appointments
router.get(
  '/:id/appointments',
  requirePermission('clients:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getClientAppointments({
      clientRelationId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/clients/:id/block - Block client
router.post(
  '/:id/block',
  requirePermission('clients:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const result = await blockClient({
      clientRelationId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      reason,
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/clients/:id/unblock - Unblock client
router.post(
  '/:id/unblock',
  requirePermission('clients:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await unblockClient({
      clientRelationId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/clients/:id/vip - Toggle VIP status
router.post(
  '/:id/vip',
  requirePermission('clients:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await toggleVip({
      clientRelationId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, data: result });
  })
);

export default router;
