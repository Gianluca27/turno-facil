import { Router, Request, Response } from 'express';
import { Business } from '../../infrastructure/database/mongodb/models/Business.js';
import { Service } from '../../infrastructure/database/mongodb/models/Service.js';
import { Staff } from '../../infrastructure/database/mongodb/models/Staff.js';
import { Review } from '../../infrastructure/database/mongodb/models/Review.js';
import { User } from '../../infrastructure/database/mongodb/models/User.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { optionalAuth, authenticateUser, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/businesses/:slug - Get business public profile
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const business = await Business.findOne({
      slug: req.params.slug,
      status: 'active',
    }).select('-subscription -ownerId');

    if (!business) {
      throw new NotFoundError('Business not found');
    }

    res.json({
      success: true,
      data: { business },
    });
  })
);

// GET /api/v1/businesses/:id/services - Get business services
router.get(
  '/:id/services',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const services = await Service.find({
      businessId: req.params.id,
      status: 'active',
    }).sort({ order: 1, name: 1 });

    // Group by category
    const business = await Business.findById(req.params.id).select('serviceCategories');
    const categories = business?.serviceCategories || [];

    const groupedServices = categories
      .filter((cat) => cat.isActive)
      .map((category) => ({
        category: {
          id: category._id,
          name: category.name,
          description: category.description,
        },
        services: services.filter(
          (s) => s.categoryId?.toString() === category._id.toString()
        ),
      }));

    // Add uncategorized services
    const uncategorized = services.filter((s) => !s.categoryId);
    if (uncategorized.length > 0) {
      groupedServices.push({
        category: { id: 'uncategorized', name: 'Otros', description: '' },
        services: uncategorized,
      });
    }

    res.json({
      success: true,
      data: { services: groupedServices, allServices: services },
    });
  })
);

// GET /api/v1/businesses/:id/staff - Get business staff
router.get(
  '/:id/staff',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const staff = await Staff.find({
      businessId: req.params.id,
      status: 'active',
    })
      .select('profile services stats.averageRating stats.totalReviews')
      .sort({ order: 1 });

    res.json({
      success: true,
      data: { staff },
    });
  })
);

// GET /api/v1/businesses/:id/reviews - Get business reviews
router.get(
  '/:id/reviews',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '20', staffId, sortBy = 'recent' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {
      businessId: req.params.id,
      status: 'active',
      'moderation.status': 'approved',
    };

    if (staffId) {
      query.staffId = staffId;
    }

    let sort: any = { createdAt: -1 };
    if (sortBy === 'rating_high') sort = { 'ratings.overall': -1 };
    if (sortBy === 'rating_low') sort = { 'ratings.overall': 1 };
    if (sortBy === 'helpful') sort = { helpfulVotes: -1 };

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('clientId', 'profile.firstName profile.avatar')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Review.countDocuments(query),
    ]);

    // Calculate rating distribution
    const distribution = await Review.aggregate([
      { $match: { businessId: req.params.id, status: 'active' } },
      { $group: { _id: '$ratings.overall', count: { $sum: 1 } } },
    ]);

    const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: distribution.find((d) => d._id === rating)?.count || 0,
    }));

    res.json({
      success: true,
      data: {
        reviews,
        ratingDistribution,
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

// GET /api/v1/businesses/:id/availability - Get availability
router.get(
  '/:id/availability',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { date, serviceIds, staffId } = req.query;

    if (!date) {
      return res.json({
        success: true,
        data: { slots: [] },
      });
    }

    const { Appointment } = await import('../../infrastructure/database/mongodb/models/Appointment.js');

    const business = await Business.findById(req.params.id).select('schedule bookingConfig');
    if (!business) {
      throw new NotFoundError('Business not found');
    }

    const requestedDate = new Date(date as string);
    const dayOfWeek = requestedDate.getDay();

    // Check if business is open on this day
    const daySchedule = business.schedule.regular.find((d) => d.dayOfWeek === dayOfWeek);
    if (!daySchedule?.isOpen) {
      return res.json({
        success: true,
        data: { slots: [], message: 'Business is closed on this day' },
      });
    }

    // Get staff for this service
    let staffList = await Staff.find({
      businessId: req.params.id,
      status: 'active',
    });

    if (staffId) {
      staffList = staffList.filter((s) => s._id.toString() === staffId);
    }

    if (serviceIds) {
      const ids = (serviceIds as string).split(',');
      staffList = staffList.filter((s) =>
        ids.some((id) => s.services.map((sid) => sid.toString()).includes(id))
      );
    }

    // Get existing appointments for this day
    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await Appointment.find({
      businessId: req.params.id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed', 'checked_in', 'in_progress'] },
    });

    // Generate available slots
    const slotDuration = business.bookingConfig.slotDuration;
    const bufferTime = business.bookingConfig.bufferTime;
    const slots: Array<{ time: string; available: boolean; staffAvailable: string[] }> = [];

    for (const slot of daySchedule.slots) {
      let currentTime = timeToMinutes(slot.open);
      const closeTime = timeToMinutes(slot.close);

      while (currentTime + slotDuration <= closeTime) {
        const timeString = minutesToTime(currentTime);
        const staffAvailable: string[] = [];

        for (const staff of staffList) {
          // Check if staff is available at this time
          const isBooked = existingAppointments.some((apt) => {
            if (apt.staffId.toString() !== staff._id.toString()) return false;

            const aptStart = timeToMinutes(apt.startTime);
            const aptEnd = timeToMinutes(apt.endTime) + bufferTime;

            return currentTime < aptEnd && currentTime + slotDuration > aptStart;
          });

          if (!isBooked) {
            staffAvailable.push(staff._id.toString());
          }
        }

        slots.push({
          time: timeString,
          available: staffAvailable.length > 0,
          staffAvailable,
        });

        currentTime += slotDuration;
      }
    }

    res.json({
      success: true,
      data: { slots, date: date as string },
    });
  })
);

// GET /api/v1/businesses/:id/promotions - Get active promotions
router.get(
  '/:id/promotions',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { Promotion } = await import('../../infrastructure/database/mongodb/models/Promotion.js');

    const now = new Date();
    const promotions = await Promotion.find({
      businessId: req.params.id,
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    }).select('-limits.currentUses');

    res.json({
      success: true,
      data: { promotions },
    });
  })
);

// POST /api/v1/businesses/:id/favorite - Add to favorites
router.post(
  '/:id/favorite',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await User.findByIdAndUpdate(req.user!.id, {
      $addToSet: { 'favorites.businesses': req.params.id },
    });

    res.json({
      success: true,
      message: 'Added to favorites',
    });
  })
);

// DELETE /api/v1/businesses/:id/favorite - Remove from favorites
router.delete(
  '/:id/favorite',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await User.findByIdAndUpdate(req.user!.id, {
      $pull: { 'favorites.businesses': req.params.id },
    });

    res.json({
      success: true,
      message: 'Removed from favorites',
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
