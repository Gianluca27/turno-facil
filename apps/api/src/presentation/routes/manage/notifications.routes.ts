import { Router, Response } from 'express';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../../../application/use-cases/notifications/index.js';

const router = Router();

// GET /api/v1/manage/notifications - Get all notifications
router.get(
  '/',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const { notifications, pagination } = await listNotifications({
      userId,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    res.json({ success: true, data: { notifications, pagination } });
  })
);

// GET /api/v1/manage/notifications/unread-count - Get unread count
router.get(
  '/unread-count',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { count } = await getUnreadCount({ userId });
    res.json({ success: true, data: { count } });
  })
);

// PUT /api/v1/manage/notifications/:id/read - Mark notification as read
router.put(
  '/:id/read',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const notificationId = req.params.id;
    const { notification } = await markAsRead({ notificationId, userId });
    res.json({ success: true, data: { notification } });
  })
);

// PUT /api/v1/manage/notifications/read-all - Mark all notifications as read
router.put(
  '/read-all',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { modifiedCount } = await markAllAsRead({ userId });
    res.json({ success: true, data: { modifiedCount } });
  })
);

// DELETE /api/v1/manage/notifications/:id - Delete notification
router.delete(
  '/:id',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const notificationId = req.params.id;
    await deleteNotification({ notificationId, userId });
    res.json({ success: true });
  })
);

export default router;
