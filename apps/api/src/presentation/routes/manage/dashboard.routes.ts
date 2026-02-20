import { Router, Response } from 'express';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getDashboardOverview, getTodayView, getDashboardStats } from '../../../application/use-cases/dashboard/index.js';

const router = Router();

// GET /api/v1/manage/dashboard - Get dashboard overview
router.get(
  '/',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { overview } = await getDashboardOverview({ businessId });
    res.json({ success: true, data: overview });
  })
);

// GET /api/v1/manage/dashboard/today - Get today's detailed view
router.get(
  '/today',
  requirePermission('appointments:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { today } = await getTodayView({ businessId });
    res.json({ success: true, data: today });
  })
);

// GET /api/v1/manage/dashboard/stats - Get detailed statistics
router.get(
  '/stats',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const { stats } = await getDashboardStats({ businessId, startDate, endDate });
    res.json({ success: true, data: stats });
  })
);

export default router;
