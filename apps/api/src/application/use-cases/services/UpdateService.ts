import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateServiceInput {
  serviceId: string;
  businessId: string;
  data: {
    name?: string;
    description?: string;
    categoryId?: string;
    category?: string;
    duration?: number;
    price?: number;
    config?: {
      bufferAfter?: number;
      maxPerDay?: number;
      requiresDeposit?: boolean;
      depositAmount?: number;
      allowOnlineBooking?: boolean;
    };
    image?: string;
  };
}

export interface UpdateServiceResult {
  service: any;
}

export async function updateService(input: UpdateServiceInput): Promise<UpdateServiceResult> {
  const { serviceId, businessId, data } = input;

  const service = await Service.findOneAndUpdate(
    { _id: serviceId, businessId },
    { $set: data },
    { new: true, runValidators: true },
  );

  if (!service) throw new NotFoundError('Service not found');

  logger.info('Service updated', { serviceId, businessId });

  return { service };
}
