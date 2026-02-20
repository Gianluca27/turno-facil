import { Router, Response } from 'express';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  getAnalyticsOverview,
  getAppointmentAnalytics,
  getServiceAnalytics,
  getStaffAnalytics,
  getClientAnalytics,
  getTrends,
} from '../../../application/use-cases/analytics/index.js';

const router = Router();

// GET /api/v1/manage/analytics/overview - Get analytics overview
router.get(
  '/overview',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { period } = req.query as { period?: string };
    const data = await getAnalyticsOverview({ businessId, period });
    res.json({ success: true, data });
  })
);

// GET /api/v1/manage/analytics/appointments - Appointment analytics
router.get(
  '/appointments',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { startDate, endDate, groupBy } = req.query as Record<string, string | undefined>;
    const data = await getAppointmentAnalytics({ businessId, startDate, endDate, groupBy });
    res.json({ success: true, data });
  })
);

// GET /api/v1/manage/analytics/services - Service analytics
router.get(
  '/services',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const data = await getServiceAnalytics({ businessId, startDate, endDate });
    res.json({ success: true, data });
  })
);

// GET /api/v1/manage/analytics/staff - Staff analytics
router.get(
  '/staff',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const data = await getStaffAnalytics({ businessId, startDate, endDate });
    res.json({ success: true, data });
  })
);

// GET /api/v1/manage/analytics/clients - Client analytics
router.get(
  '/clients',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const data = await getClientAnalytics({ businessId, startDate, endDate });
    res.json({ success: true, data });
  })
);

// GET /api/v1/manage/analytics/trends - Business trends
router.get(
  '/trends',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { months } = req.query as { months?: string };
    const data = await getTrends({ businessId, months });
    res.json({ success: true, data });
  })
);

export default router;
