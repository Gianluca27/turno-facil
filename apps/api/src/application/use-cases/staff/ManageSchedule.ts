import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateScheduleInput {
  staffId: string;
  businessId: string;
  useBusinessSchedule: boolean;
  custom?: any[];
}

export interface UpdateScheduleResult {
  staff: any;
}

export async function updateSchedule(input: UpdateScheduleInput): Promise<UpdateScheduleResult> {
  const { staffId, businessId, useBusinessSchedule, custom } = input;

  const staff = await Staff.findOneAndUpdate(
    { _id: staffId, businessId },
    { $set: { schedule: { useBusinessSchedule, custom: custom || [] } } },
    { new: true },
  );

  if (!staff) throw new NotFoundError('Staff member not found');

  logger.info('Staff schedule updated', { staffId, businessId });

  return { staff };
}

export interface AddExceptionInput {
  staffId: string;
  businessId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason?: string;
}

export interface AddExceptionResult {
  staff: any;
}

export async function addException(input: AddExceptionInput): Promise<AddExceptionResult> {
  const { staffId, businessId, startDate, endDate, type, reason } = input;

  const staff = await Staff.findOneAndUpdate(
    { _id: staffId, businessId },
    { $push: { exceptions: { startDate: new Date(startDate), endDate: new Date(endDate), type, reason, isRecurring: false } } },
    { new: true },
  );

  if (!staff) throw new NotFoundError('Staff member not found');

  logger.info('Staff exception added', { staffId, businessId, type });

  return { staff };
}

export interface AssignServicesInput {
  staffId: string;
  businessId: string;
  serviceIds: string[];
}

export interface AssignServicesResult {
  staff: any;
}

export async function assignServices(input: AssignServicesInput): Promise<AssignServicesResult> {
  const { staffId, businessId, serviceIds } = input;

  const staff = await Staff.findOneAndUpdate(
    { _id: staffId, businessId },
    { $set: { services: serviceIds } },
    { new: true },
  ).populate('services', 'name');

  if (!staff) throw new NotFoundError('Staff member not found');

  logger.info('Staff services assigned', { staffId, businessId, serviceCount: serviceIds.length });

  return { staff };
}
