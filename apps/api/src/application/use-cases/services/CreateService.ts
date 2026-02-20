import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface CreateServiceInput {
  businessId: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: string;
  duration: number;
  price: number;
  config?: {
    bufferAfter?: number;
    maxPerDay?: number;
    requiresDeposit?: boolean;
    depositAmount?: number;
    allowOnlineBooking?: boolean;
  };
  image?: string;
  staffIds?: string[];
}

export interface CreateServiceResult {
  service: any;
}

export async function createService(input: CreateServiceInput): Promise<CreateServiceResult> {
  const { businessId, staffIds, ...serviceData } = input;

  const business = await Business.findById(businessId);
  if (!business) throw new NotFoundError('Business not found');

  const service = new Service({
    ...serviceData,
    businessId,
    status: 'active',
  });

  await service.save();

  if (staffIds && staffIds.length > 0) {
    await Staff.updateMany(
      { _id: { $in: staffIds }, businessId },
      { $addToSet: { services: service._id } },
    );
  }

  logger.info('Service created', { serviceId: service._id, businessId });

  return { service };
}
