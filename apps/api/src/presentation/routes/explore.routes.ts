import { Router, Request, Response } from 'express';
import { Business } from '../../infrastructure/database/mongodb/models/Business.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import config from '../../config/index.js';

const router = Router();

// GET /api/v1/explore/businesses - Search businesses
router.get(
  '/businesses',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      q,
      type,
      lat,
      lng,
      distance = '10000', // 10km default
      rating,
      priceRange,
      hasAvailability,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), config.pagination.maxLimit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = { status: 'active' };

    // Text search
    if (q) {
      query.$text = { $search: q as string };
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Geolocation filter
    if (lat && lng) {
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
          },
          $maxDistance: parseInt(distance as string),
        },
      };
    }

    // Rating filter
    if (rating) {
      query['stats.averageRating'] = { $gte: parseFloat(rating as string) };
    }

    // Execute query
    const [businesses, total] = await Promise.all([
      Business.find(query)
        .select('name slug type description media.logo location.city location.address stats.averageRating stats.totalReviews')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Business.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        businesses,
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

// GET /api/v1/explore/businesses/nearby - Get nearby businesses
router.get(
  '/businesses/nearby',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { lat, lng, distance = '5000', type, limit = '20' } = req.query;

    if (!lat || !lng) {
      return res.json({
        success: true,
        data: { businesses: [] },
      });
    }

    const query: any = {
      status: 'active',
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
          },
          $maxDistance: parseInt(distance as string),
        },
      },
    };

    if (type) {
      query.type = type;
    }

    const businesses = await Business.find(query)
      .select('name slug type media.logo location stats.averageRating stats.totalReviews')
      .limit(Math.min(parseInt(limit as string), 50))
      .lean();

    res.json({
      success: true,
      data: { businesses },
    });
  })
);

// GET /api/v1/explore/businesses/featured - Get featured businesses
router.get(
  '/businesses/featured',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, limit = '10' } = req.query;

    const query: any = {
      status: 'active',
      'stats.averageRating': { $gte: 4 },
      'stats.totalReviews': { $gte: 5 },
    };

    if (type) {
      query.type = type;
    }

    const businesses = await Business.find(query)
      .select('name slug type description media.logo media.cover location.city stats.averageRating stats.totalReviews')
      .sort({ 'stats.averageRating': -1, 'stats.totalReviews': -1 })
      .limit(Math.min(parseInt(limit as string), 20))
      .lean();

    res.json({
      success: true,
      data: { businesses },
    });
  })
);

// GET /api/v1/explore/businesses/recommended - Get recommended businesses for user
router.get(
  '/businesses/recommended',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit = '10' } = req.query;

    // TODO: Implement recommendation algorithm based on:
    // - User's previous bookings
    // - User's favorites
    // - User's location
    // - Similar users' preferences

    // For now, return top-rated businesses
    const businesses = await Business.find({ status: 'active' })
      .select('name slug type media.logo location.city stats.averageRating stats.totalReviews')
      .sort({ 'stats.averageRating': -1 })
      .limit(Math.min(parseInt(limit as string), 20))
      .lean();

    res.json({
      success: true,
      data: { businesses },
    });
  })
);

// GET /api/v1/explore/categories - Get business categories
router.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    // Predefined categories
    const categories = [
      { id: 'barberia', name: 'Barbería', icon: 'content-cut' },
      { id: 'peluqueria', name: 'Peluquería', icon: 'scissors-cutting' },
      { id: 'spa', name: 'Spa', icon: 'spa' },
      { id: 'nails', name: 'Uñas', icon: 'hand-wave' },
      { id: 'estetica', name: 'Estética', icon: 'face-woman-shimmer' },
      { id: 'masajes', name: 'Masajes', icon: 'massage' },
      { id: 'depilacion', name: 'Depilación', icon: 'content-cut' },
      { id: 'maquillaje', name: 'Maquillaje', icon: 'lipstick' },
      { id: 'tatuajes', name: 'Tatuajes', icon: 'needle' },
      { id: 'taller', name: 'Taller Mecánico', icon: 'car-wrench' },
      { id: 'medico', name: 'Consultorio Médico', icon: 'hospital' },
      { id: 'dentista', name: 'Dentista', icon: 'tooth' },
      { id: 'veterinaria', name: 'Veterinaria', icon: 'paw' },
      { id: 'otros', name: 'Otros', icon: 'dots-horizontal' },
    ];

    // Get count per category
    const counts = await Business.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const countMap = counts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {} as Record<string, number>);

    const categoriesWithCount = categories.map((cat) => ({
      ...cat,
      count: countMap[cat.id] || 0,
    }));

    res.json({
      success: true,
      data: { categories: categoriesWithCount },
    });
  })
);

export default router;
