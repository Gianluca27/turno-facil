import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../../middleware/errorHandler.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';

const router = Router();

// GET /api/v1/manage/appointments - List appointments
router.get(
  '/',
  requirePermission('appointments:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { date, from, to, staffId, status, page = '1', limit = '50' } = req.query;

    const query: any = { businessId };

    if (date) {
      const d = new Date(date as string);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: d, $lt: nextDay };
    } else if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from as string);
      if (to) query.date.$lte = new Date(to as string);
    }

    if (staffId) query.staffId = staffId;
    if (status) query.status = status;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate('staffId', 'profile')
        .populate('clientId', 'profile phone')
        .sort({ startDateTime: 1 })
        .skip(skip)
        .limit(limitNum),
      Appointment.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      },
    });
  })
);

// POST /api/v1/manage/appointments - Create manual appointment
router.post(
  '/',
  requirePermission('appointments:create'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const schema = z.object({
      clientName: z.string().min(2),
      clientPhone: z.string().min(8),
      clientEmail: z.string().email().optional(),
      staffId: z.string(),
      serviceIds: z.array(z.string()).min(1),
      date: z.string(),
      startTime: z.string(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    const staff = await Staff.findOne({ _id: data.staffId, businessId, status: 'active' });
    if (!staff) throw new NotFoundError('Staff not found');

    const services = await Service.find({ _id: { $in: data.serviceIds }, businessId, status: 'active' });
    if (services.length !== data.serviceIds.length) throw new BadRequestError('One or more services not found');

    let totalDuration = 0;
    let subtotal = 0;
    const appointmentServices = services.map((s) => {
      totalDuration += s.duration;
      subtotal += s.finalPrice;
      return { serviceId: s._id, name: s.name, duration: s.duration, price: s.price, discount: s.price - s.finalPrice };
    });

    const startMinutes = timeToMinutes(data.startTime);
    const endMinutes = startMinutes + totalDuration;
    const endTime = minutesToTime(endMinutes);

    const appointmentDate = new Date(data.date);
    const startDateTime = new Date(`${data.date}T${data.startTime}:00`);
    const endDateTime = new Date(`${data.date}T${endTime}:00`);

    const appointment = new Appointment({
      businessId,
      clientInfo: { name: data.clientName, phone: data.clientPhone, email: data.clientEmail },
      staffId: data.staffId,
      staffInfo: { name: `${staff.profile.firstName} ${staff.profile.lastName}` },
      services: appointmentServices,
      date: appointmentDate,
      startTime: data.startTime,
      endTime,
      startDateTime,
      endDateTime,
      totalDuration,
      pricing: { subtotal, discount: 0, deposit: 0, depositPaid: false, total: subtotal, tip: 0, finalTotal: subtotal },
      status: 'confirmed',
      notes: { business: data.notes },
      source: 'app_business',
      createdBy: new mongoose.Types.ObjectId(req.user!.id),
    });

    await appointment.save();

    res.status(201).json({ success: true, data: { appointment } });
  })
);

// GET /api/v1/manage/appointments/:id - Get appointment details
router.get(
  '/:id',
  requirePermission('appointments:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    })
      .populate('staffId', 'profile')
      .populate('clientId', 'profile phone email');

    if (!appointment) throw new NotFoundError('Appointment not found');

    res.json({ success: true, data: { appointment } });
  })
);

// POST /api/v1/manage/appointments/:id/confirm - Confirm appointment
router.post(
  '/:id/confirm',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId, status: 'pending' },
      { status: 'confirmed' },
      { new: true }
    );
    if (!appointment) throw new NotFoundError('Appointment not found or already confirmed');
    res.json({ success: true, data: { appointment } });
  })
);

// POST /api/v1/manage/appointments/:id/check-in - Check-in client
router.post(
  '/:id/check-in',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId, status: { $in: ['pending', 'confirmed'] } },
      { status: 'checked_in' },
      { new: true }
    );
    if (!appointment) throw new NotFoundError('Appointment not found');
    res.json({ success: true, data: { appointment } });
  })
);

// POST /api/v1/manage/appointments/:id/start - Start service
router.post(
  '/:id/start',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId, status: 'checked_in' },
      { status: 'in_progress' },
      { new: true }
    );
    if (!appointment) throw new NotFoundError('Appointment not found or not checked in');
    res.json({ success: true, data: { appointment } });
  })
);

// POST /api/v1/manage/appointments/:id/complete - Complete appointment
router.post(
  '/:id/complete',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId, status: { $in: ['checked_in', 'in_progress'] } },
      { status: 'completed' },
      { new: true }
    );
    if (!appointment) throw new NotFoundError('Appointment not found');
    res.json({ success: true, data: { appointment } });
  })
);

// POST /api/v1/manage/appointments/:id/cancel - Cancel appointment
router.post(
  '/:id/cancel',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId, status: { $in: ['pending', 'confirmed'] } },
      { status: 'cancelled', cancellation: { cancelledAt: new Date(), cancelledBy: 'business', reason, refunded: false, refundAmount: 0 } },
      { new: true }
    );
    if (!appointment) throw new NotFoundError('Appointment not found or cannot be cancelled');
    res.json({ success: true, data: { appointment } });
  })
);

// POST /api/v1/manage/appointments/:id/no-show - Mark as no-show
router.post(
  '/:id/no-show',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId, status: { $in: ['pending', 'confirmed', 'checked_in'] } },
      { status: 'no_show' },
      { new: true }
    );
    if (!appointment) throw new NotFoundError('Appointment not found');
    res.json({ success: true, data: { appointment } });
  })
);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default router;
