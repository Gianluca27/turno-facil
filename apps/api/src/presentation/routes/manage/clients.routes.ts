import { Router, Response } from 'express';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../../middleware/errorHandler.js';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';

const router = Router();

// GET /api/v1/manage/clients - List clients
router.get(
  '/',
  requirePermission('clients:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { q: _searchQuery, segment, page = '1', limit = '20' } = req.query;

    const query: any = { businessId };

    if (segment === 'vip') query['clientInfo.tags'] = 'VIP';
    if (segment === 'blocked') query.isBlocked = true;
    if (segment === 'inactive') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query['stats.lastVisit'] = { $lt: thirtyDaysAgo };
    }

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 50);
    const skip = (pageNum - 1) * limitNum;

    const [clients, total] = await Promise.all([
      ClientBusinessRelation.find(query)
        .populate('clientId', 'profile email phone')
        .sort({ 'stats.lastVisit': -1 })
        .skip(skip)
        .limit(limitNum),
      ClientBusinessRelation.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        clients,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      },
    });
  })
);

// GET /api/v1/manage/clients/:id - Get client details
router.get(
  '/:id',
  requirePermission('clients:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const client = await ClientBusinessRelation.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    }).populate('clientId', 'profile email phone');

    if (!client) throw new NotFoundError('Client not found');

    res.json({ success: true, data: { client } });
  })
);

// PUT /api/v1/manage/clients/:id - Update client info
router.put(
  '/:id',
  requirePermission('clients:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { tags, notes, allergies, preferences } = req.body;

    const client = await ClientBusinessRelation.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { $set: { 'clientInfo.tags': tags, 'clientInfo.notes': notes, 'clientInfo.allergies': allergies, 'clientInfo.preferences': preferences } },
      { new: true }
    );

    if (!client) throw new NotFoundError('Client not found');

    res.json({ success: true, data: { client } });
  })
);

// GET /api/v1/manage/clients/:id/appointments - Get client appointments
router.get(
  '/:id/appointments',
  requirePermission('clients:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const client = await ClientBusinessRelation.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!client) throw new NotFoundError('Client not found');

    const appointments = await Appointment.find({
      businessId: req.currentBusiness!.businessId,
      clientId: client.clientId,
    })
      .populate('staffId', 'profile')
      .sort({ startDateTime: -1 })
      .limit(50);

    res.json({ success: true, data: { appointments } });
  })
);

// POST /api/v1/manage/clients/:id/block - Block client
router.post(
  '/:id/block',
  requirePermission('clients:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { reason } = req.body;

    const client = await ClientBusinessRelation.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { isBlocked: true, blockedAt: new Date(), blockedReason: reason },
      { new: true }
    );

    if (!client) throw new NotFoundError('Client not found');

    res.json({ success: true, data: { client } });
  })
);

// POST /api/v1/manage/clients/:id/unblock - Unblock client
router.post(
  '/:id/unblock',
  requirePermission('clients:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const client = await ClientBusinessRelation.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { isBlocked: false, blockedAt: null, blockedReason: null },
      { new: true }
    );

    if (!client) throw new NotFoundError('Client not found');

    res.json({ success: true, data: { client } });
  })
);

// POST /api/v1/manage/clients/:id/vip - Toggle VIP status
router.post(
  '/:id/vip',
  requirePermission('clients:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const client = await ClientBusinessRelation.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!client) throw new NotFoundError('Client not found');

    const hasVip = client.clientInfo.tags.includes('VIP');
    const update = hasVip
      ? { $pull: { 'clientInfo.tags': 'VIP' } }
      : { $addToSet: { 'clientInfo.tags': 'VIP' } };

    const updated = await ClientBusinessRelation.findByIdAndUpdate(req.params.id, update, { new: true });

    res.json({ success: true, data: { client: updated, isVip: !hasVip } });
  })
);

export default router;
