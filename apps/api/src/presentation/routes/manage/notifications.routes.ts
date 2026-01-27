import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../../../infrastructure/database/mongodb/models/Notification.js';
import { asyncHandler, NotFoundError } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/manage/notifications - Get all notifications
router.get(
  '/',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const userId = req.user!.id;
    const {
      read,
      type,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = {
      businessId: new mongoose.Types.ObjectId(businessId),
      recipientId: new mongoose.Types.ObjectId(userId),
    };

    if (read !== undefined) {
      query.read = read === 'true';
    }

    if (type) {
      query.type = type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({
        businessId: new mongoose.Types.ObjectId(businessId),
        recipientId: new mongoose.Types.ObjectId(userId),
        read: false,
      }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// GET /api/v1/manage/notifications/unread-count - Get unread count
router.get(
  '/unread-count',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const userId = req.user!.id;

    const count = await Notification.countDocuments({
      businessId: new mongoose.Types.ObjectId(businessId),
      recipientId: new mongoose.Types.ObjectId(userId),
      read: false,
    });

    res.json({
      success: true,
      data: { count },
    });
  })
);

// PUT /api/v1/manage/notifications/:id/read - Mark notification as read
router.put(
  '/:id/read',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const userId = req.user!.id;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        businessId: new mongoose.Types.ObjectId(businessId),
        recipientId: new mongoose.Types.ObjectId(userId),
      },
      {
        read: true,
        readAt: new Date(),
      },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification },
    });
  })
);

// PUT /api/v1/manage/notifications/read-all - Mark all notifications as read
router.put(
  '/read-all',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const userId = req.user!.id;

    const result = await Notification.updateMany(
      {
        businessId: new mongoose.Types.ObjectId(businessId),
        recipientId: new mongoose.Types.ObjectId(userId),
        read: false,
      },
      {
        read: true,
        readAt: new Date(),
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: { modifiedCount: result.modifiedCount },
    });
  })
);

// DELETE /api/v1/manage/notifications/:id - Delete notification
router.delete(
  '/:id',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const userId = req.user!.id;

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      businessId: new mongoose.Types.ObjectId(businessId),
      recipientId: new mongoose.Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  })
);

// POST /api/v1/manage/notifications/settings - Update notification settings
router.post(
  '/settings',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = req.body;
    const _businessId = req.currentBusiness!.businessId;

    // This would update the business notification settings
    // For now, just return success
    res.json({
      success: true,
      message: 'Notification settings updated',
      data: { settings: data, businessId: _businessId },
    });
  })
);

export default router;
