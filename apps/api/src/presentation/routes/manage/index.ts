import { Router, Response } from 'express';
import {
  authenticateBusinessUser,
  setBusinessContext,
  requirePermission,
  BusinessAuthenticatedRequest,
} from '../../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../../middleware/errorHandler.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';

// Import route modules
import dashboardRoutes from './dashboard.routes.js';
import appointmentsRoutes from './appointments.routes.js';
import servicesRoutes from './services.routes.js';
import staffRoutes from './staff.routes.js';
import clientsRoutes from './clients.routes.js';
import settingsRoutes from './settings.routes.js';
import financesRoutes from './finances.routes.js';
import marketingRoutes from './marketing.routes.js';
import analyticsRoutes from './analytics.routes.js';
import waitlistRoutes from './waitlist.routes.js';
import posRoutes from './pos.routes.js';
import reviewsRoutes from './reviews.routes.js';

const router = Router();

// All routes require business user authentication
router.use(authenticateBusinessUser);

// Set business context for all routes
router.use(setBusinessContext());

// GET /api/v1/manage/business - Get current business
router.get(
  '/business',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const business = await Business.findById(req.currentBusiness!.businessId);

    if (!business) {
      throw new NotFoundError('Business not found');
    }

    res.json({
      success: true,
      data: {
        business,
        userRole: req.currentBusiness!.role,
        userPermissions: req.currentBusiness!.permissions,
      },
    });
  })
);

// Mount route modules
router.use('/dashboard', dashboardRoutes);
router.use('/appointments', appointmentsRoutes);
router.use('/services', servicesRoutes);
router.use('/staff', staffRoutes);
router.use('/clients', clientsRoutes);
router.use('/settings', settingsRoutes);
router.use('/finances', financesRoutes);
router.use('/marketing', marketingRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/waitlist', waitlistRoutes);
router.use('/pos', posRoutes);
router.use('/reviews', reviewsRoutes);

export default router;
