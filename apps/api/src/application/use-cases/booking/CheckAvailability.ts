import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { timeToMinutes, minutesToTime, ACTIVE_STATUSES } from './shared.js';

export interface AvailabilityInput {
  businessId: string;
  staffId: string;
  serviceIds: string[];
  date: string;
  startTime: string;
}

export interface AvailabilityResult {
  available: boolean;
  startTime: string;
  endTime: string;
  totalDuration: number;
}

/**
 * Checks whether a specific time slot is available for a staff member,
 * considering existing appointments and buffer time.
 */
export async function checkAvailability(input: AvailabilityInput): Promise<AvailabilityResult> {
  const { businessId, staffId, serviceIds, date, startTime } = input;

  if (!businessId || !staffId || !serviceIds || !date || !startTime) {
    throw new BadRequestError('All fields are required');
  }

  const business = await Business.findById(businessId).select('bookingConfig');
  const services = await Service.find({ _id: { $in: serviceIds } });

  const serviceDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const bufferTime = business?.bookingConfig?.bufferTime || 0;
  const totalDuration = serviceDuration + bufferTime;

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + serviceDuration;
  const endTime = minutesToTime(endMinutes);

  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  const conflicting = await Appointment.findOne({
    businessId,
    staffId,
    date: new Date(date),
    status: { $in: ACTIVE_STATUSES },
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime },
  });

  return {
    available: !conflicting,
    startTime,
    endTime,
    totalDuration,
  };
}

/**
 * Checks availability excluding a specific appointment (for rescheduling).
 */
export async function checkAvailabilityExcluding(
  input: AvailabilityInput & { excludeAppointmentId: string },
): Promise<boolean> {
  const { businessId, staffId, serviceIds, date, startTime, excludeAppointmentId } = input;

  const services = await Service.find({ _id: { $in: serviceIds } });
  const serviceDuration = services.reduce((sum, s) => sum + s.duration, 0);

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + serviceDuration;
  const endTime = minutesToTime(endMinutes);

  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  const conflicting = await Appointment.findOne({
    _id: { $ne: excludeAppointmentId },
    businessId,
    staffId,
    date: new Date(date),
    status: { $in: ACTIVE_STATUSES },
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime },
  });

  return !conflicting;
}
