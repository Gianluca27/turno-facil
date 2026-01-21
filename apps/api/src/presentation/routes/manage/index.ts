import { Router, Response } from 'express';
import { authenticateBusinessUser, setBusinessContext, requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../../middleware/errorHandler.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';

// Import route modules
import dashboardRoutes from './dashboard.routes.js';
import appointmentsRoutes from './appointments.routes.js';
import servicesRoutes from './services.routes.js';
import staffRoutes from './staff.routes.js';
import clientsRoutes from './clients.routes.js';
import settingsRoutes from './settings.routes.js';

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

// Placeholder routes for features to be implemented
router.use('/finances', (_req, res) => {
  res.json({ success: true, message: 'Finances routes - Coming soon' });
});

router.use('/marketing', (_req, res) => {
  res.json({ success: true, message: 'Marketing routes - Coming soon' });
});

router.use('/analytics', (_req, res) => {
  res.json({ success: true, message: 'Analytics routes - Coming soon' });
});

router.use('/waitlist', (_req, res) => {
  res.json({ success: true, message: 'Waitlist routes - Coming soon' });
});

router.use('/pos', (_req, res) => {
  res.json({ success: true, message: 'POS routes - Coming soon' });
});

router.use('/reviews', (_req, res) => {
  res.json({ success: true, message: 'Reviews routes - Coming soon' });
});

export default router;
