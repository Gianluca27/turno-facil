import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Waitlist } from '../../../infrastructure/database/mongodb/models/Waitlist.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { asyncHandler, NotFoundError, BadRequestError, ConflictError } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { logger } from '../../../utils/logger.js';

const router = Router();

// Validation schemas
const createWaitlistEntrySchema = z.object({
  clientId: z.string().optional(),
  clientInfo: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().min(8).max(20),
    email: z.string().email().optional(),
  }).optional(),
  serviceIds: z.array(z.string()).min(1),
  preferredStaffId: z.string().optional(),
  preferredDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  preferredTimeRange: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  notes: z.string().max(500).optional(),
  priority: z.enum(['normal', 'high', 'vip']).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateWaitlistEntrySchema = z.object({
  preferredStaffId: z.string().optional().nullable(),
  preferredDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  preferredTimeRange: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional().nullable(),
  notes: z.string().max(500).optional(),
  priority: z.enum(['normal', 'high', 'vip']).optional(),
  status: z.enum(['waiting', 'contacted', 'booked', 'expired', 'cancelled']).optional(),
});

// GET /api/v1/manage/waitlist - Get waitlist entries
router.get(
  '/',
  requirePermission('waitlist:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const {
      status = 'waiting',
      serviceId,
      staffId,
      priority,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = { businessId };

    if (status !== 'all') {
      query.status = status;
    }

    if (serviceId) {
      query.serviceIds = serviceId;
    }

    if (staffId) {
      query.preferredStaffId = staffId;
    }

    if (priority) {
      query.priority = priority;
    }

    const [entries, total] = await Promise.all([
      Waitlist.find(query)
        .populate('clientId', 'profile.firstName profile.lastName email phone')
        .populate('serviceIds', 'name duration price')
        .populate('preferredStaffId', 'profile.firstName profile.lastName')
        .sort({ priority: -1, createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Waitlist.countDocuments(query),
    ]);

    // Get stats
    const stats = await Waitlist.aggregate([
      { $match: { businessId: new mongoose.Types.ObjectId(businessId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s._id, s.count]));

    res.json({
      success: true,
      data: {
        entries,
        stats: {
          waiting: statsMap.waiting || 0,
          contacted: statsMap.contacted || 0,
          booked: statsMap.booked || 0,
          expired: statsMap.expired || 0,
          cancelled: statsMap.cancelled || 0,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// POST /api/v1/manage/waitlist - Create waitlist entry
router.post(
  '/',
  requirePermission('waitlist:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createWaitlistEntrySchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // Validate client
    let clientInfo = data.clientInfo;
    if (data.clientId) {
      const user = await User.findById(data.clientId).select('profile email phone');
      if (!user) {
        throw new NotFoundError('Client not found');
      }
      clientInfo = {
        name: `${user.profile.firstName} ${user.profile.lastName}`,
        phone: user.phone || '',
        email: user.email,
      };
    }

    if (!clientInfo) {
      throw new BadRequestError('Client information is required');
    }

    // Validate services
    const services = await Service.find({
      _id: { $in: data.serviceIds },
      businessId,
      status: 'active',
    });

    if (services.length !== data.serviceIds.length) {
      throw new BadRequestError('One or more services not found');
    }

    // Validate staff if provided
    if (data.preferredStaffId) {
      const staff = await Staff.findOne({
        _id: data.preferredStaffId,
        businessId,
        status: 'active',
      });
      if (!staff) {
        throw new NotFoundError('Staff not found');
      }
    }

    // Check for existing waitlist entry
    if (data.clientId) {
      const existingEntry = await Waitlist.findOne({
        businessId,
        clientId: data.clientId,
        status: 'waiting',
        serviceIds: { $in: data.serviceIds },
      });

      if (existingEntry) {
        throw new ConflictError('Client already has a waitlist entry for this service');
      }
    }

    // Calculate total duration
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

    const waitlistEntry = new Waitlist({
      businessId,
      clientId: data.clientId,
      clientInfo,
      serviceIds: data.serviceIds,
      totalDuration,
      preferredStaffId: data.preferredStaffId,
      preferredDates: data.preferredDates?.map((d) => new Date(d)),
      preferredTimeRange: data.preferredTimeRange,
      notes: data.notes,
      priority: data.priority || 'normal',
      status: 'waiting',
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      createdBy: req.user!.id,
    });

    await waitlistEntry.save();

    logger.info('Waitlist entry created', {
      waitlistId: waitlistEntry._id,
      businessId,
      clientInfo: clientInfo.name,
    });

    res.status(201).json({
      success: true,
      message: 'Added to waitlist successfully',
      data: { entry: waitlistEntry },
    });
  })
);

// GET /api/v1/manage/waitlist/:id - Get waitlist entry details
router.get(
  '/:id',
  requirePermission('waitlist:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const entry = await Waitlist.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    })
      .populate('clientId', 'profile email phone')
      .populate('serviceIds', 'name duration price category')
      .populate('preferredStaffId', 'profile');

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    res.json({
      success: true,
      data: { entry },
    });
  })
);

// PUT /api/v1/manage/waitlist/:id - Update waitlist entry
router.put(
  '/:id',
  requirePermission('waitlist:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = updateWaitlistEntrySchema.parse(req.body);

    const entry = await Waitlist.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    // Update fields
    if (data.preferredStaffId !== undefined) {
      entry.preferredStaffId = data.preferredStaffId
        ? new mongoose.Types.ObjectId(data.preferredStaffId)
        : undefined;
    }
    if (data.preferredDates) {
      entry.preferredDates = data.preferredDates.map((d) => new Date(d));
    }
    if (data.preferredTimeRange !== undefined) {
      entry.preferredTimeRange = data.preferredTimeRange || undefined;
    }
    if (data.notes !== undefined) {
      entry.notes = data.notes;
    }
    if (data.priority) {
      entry.priority = data.priority;
    }
    if (data.status) {
      entry.status = data.status;
      if (data.status === 'contacted') {
        entry.contactedAt = new Date();
      }
    }

    await entry.save();

    logger.info('Waitlist entry updated', {
      waitlistId: entry._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Waitlist entry updated successfully',
      data: { entry },
    });
  })
);

// POST /api/v1/manage/waitlist/:id/notify - Notify client of availability
router.post(
  '/:id/notify',
  requirePermission('waitlist:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { message, availableSlots } = req.body;

    const entry = await Waitlist.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
      status: { $in: ['waiting', 'contacted'] },
    }).populate('serviceIds', 'name');

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    // Send notification
    if (entry.clientId) {
      await notificationService.sendNotification({
        userId: entry.clientId.toString(),
        type: 'waitlist_available',
        channels: ['push', 'email', 'sms'],
        businessId: req.currentBusiness!.businessId,
        data: {
          title: '¡Hay disponibilidad!',
          body: message || `Hay un turno disponible para ${(entry.serviceIds as unknown as { name: string }[])[0]?.name || 'tu servicio'}`,
          availableSlots,
          waitlistId: entry._id.toString(),
        },
      });
    }

    // Update status
    entry.status = 'contacted';
    entry.contactedAt = new Date();
    if (!entry.notifications) {
      entry.notifications = [];
    }
    entry.notifications.push({
      sentAt: new Date(),
      message: message || 'Availability notification',
      channels: ['push', 'email', 'sms'],
    });

    await entry.save();

    logger.info('Waitlist notification sent', {
      waitlistId: entry._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Client notified successfully',
    });
  })
);

// POST /api/v1/manage/waitlist/:id/convert - Convert to appointment
router.post(
  '/:id/convert',
  requirePermission('waitlist:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { staffId, date, startTime } = req.body;

    if (!staffId || !date || !startTime) {
      throw new BadRequestError('Staff, date and time are required');
    }

    const entry = await Waitlist.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
      status: { $in: ['waiting', 'contacted'] },
    }).populate('serviceIds');

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    const businessId = req.currentBusiness!.businessId;
    const services = entry.serviceIds as unknown as Array<{
      _id: mongoose.Types.ObjectId;
      name: string;
      duration: number;
      price: number;
    }>;

    // Calculate times
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + totalDuration;
    const endTime = minutesToTime(endMinutes);

    const appointmentDate = new Date(date);
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    // Check availability
    const conflicting = await Appointment.findOne({
      businessId,
      staffId,
      date: appointmentDate,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { startDateTime: { $lt: endDateTime }, endDateTime: { $gt: startDateTime } },
      ],
    });

    if (conflicting) {
      throw new ConflictError('This time slot is not available');
    }

    // Get staff info
    const staff = await Staff.findById(staffId).select('profile');

    // Create appointment
    const appointment = new Appointment({
      businessId,
      clientId: entry.clientId,
      clientInfo: entry.clientInfo,
      staffId,
      staffInfo: {
        name: staff ? `${staff.profile.firstName} ${staff.profile.lastName}` : 'Staff',
      },
      services: services.map((s) => ({
        serviceId: s._id,
        name: s.name,
        duration: s.duration,
        price: s.price,
        discount: 0,
      })),
      date: appointmentDate,
      startTime,
      endTime,
      startDateTime,
      endDateTime,
      totalDuration,
      pricing: {
        subtotal: services.reduce((sum, s) => sum + s.price, 0),
        discount: 0,
        deposit: 0,
        depositPaid: false,
        total: services.reduce((sum, s) => sum + s.price, 0),
        tip: 0,
        finalTotal: services.reduce((sum, s) => sum + s.price, 0),
      },
      status: 'confirmed',
      source: 'waitlist',
      notes: {
        internal: `Converted from waitlist #${entry._id}`,
        client: entry.notes,
      },
      createdBy: new mongoose.Types.ObjectId(req.user!.id),
    });

    await appointment.save();

    // Update waitlist entry
    entry.status = 'booked';
    entry.convertedAppointmentId = appointment._id;
    await entry.save();

    // Send confirmation notification
    if (entry.clientId) {
      await notificationService.sendNotification({
        userId: entry.clientId.toString(),
        type: 'booking_confirmed',
        channels: ['push', 'email'],
        businessId,
        appointmentId: appointment._id.toString(),
        data: {
          fromWaitlist: true,
        },
      });
    }

    logger.info('Waitlist converted to appointment', {
      waitlistId: entry._id,
      appointmentId: appointment._id,
      businessId,
    });

    res.json({
      success: true,
      message: 'Appointment created from waitlist',
      data: { appointment },
    });
  })
);

// DELETE /api/v1/manage/waitlist/:id - Remove from waitlist
router.delete(
  '/:id',
  requirePermission('waitlist:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const entry = await Waitlist.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    entry.status = 'cancelled';
    await entry.save();

    logger.info('Waitlist entry cancelled', {
      waitlistId: entry._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Removed from waitlist',
    });
  })
);

// Utility functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export default router;
