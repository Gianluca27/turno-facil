import mongoose from 'mongoose';
import { Waitlist } from '../../../infrastructure/database/mongodb/models/Waitlist.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface CreateWaitlistEntryInput {
  businessId: string;
  clientId: string;
  preferences: {
    services: string[];
    staffId?: string;
    dateRange?: {
      start: string;
      end: string;
    };
    timeRange?: {
      start: string;
      end: string;
    };
    daysOfWeek?: number[];
  };
  priority?: string;
  expiresAt?: string;
}

export interface CreateWaitlistEntryResult {
  entry: any;
}

/**
 * Creates a new waitlist entry after validating the client, services,
 * and optional staff. Checks for duplicate active entries and sets
 * a default 30-day expiry if none is provided.
 */
export async function createWaitlistEntry(input: CreateWaitlistEntryInput): Promise<CreateWaitlistEntryResult> {
  const { businessId, clientId, preferences, priority, expiresAt } = input;

  // ---------- Validate client ----------
  const user = await User.findById(clientId).select('profile email phone');
  if (!user) {
    throw new NotFoundError('Client not found');
  }

  // ---------- Validate services ----------
  const services = await Service.find({
    _id: { $in: preferences.services },
    businessId,
    status: 'active',
  });

  if (services.length !== preferences.services.length) {
    throw new BadRequestError('One or more services not found');
  }

  // ---------- Validate staff ----------
  if (preferences.staffId) {
    const staff = await Staff.findOne({
      _id: preferences.staffId,
      businessId,
      status: 'active',
    });
    if (!staff) {
      throw new NotFoundError('Staff not found');
    }
  }

  // ---------- Check for duplicate ----------
  const existingEntry = await Waitlist.findOne({
    businessId,
    clientId,
    status: 'active',
    'preferences.services': { $in: preferences.services },
  });

  if (existingEntry) {
    throw new ConflictError('Client already has a waitlist entry for this service');
  }

  // ---------- Create entry ----------
  const waitlistEntry = new Waitlist({
    businessId,
    clientId,
    preferences: {
      services: preferences.services,
      staffId: preferences.staffId,
      dateRange: preferences.dateRange,
      timeRange: preferences.timeRange,
      daysOfWeek: preferences.daysOfWeek,
    },
    priority: priority || 'normal',
    status: 'active',
    notifications: [],
    expiresAt: expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
  });

  await waitlistEntry.save();

  logger.info('Waitlist entry created', {
    waitlistId: waitlistEntry._id,
    businessId,
    clientId,
  });

  return { entry: waitlistEntry };
}
