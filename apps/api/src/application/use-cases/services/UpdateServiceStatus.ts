import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateServiceStatusInput {
  serviceId: string;
  businessId: string;
  status: string;
}

export interface UpdateServiceStatusResult {
  service: any;
}

const VALID_STATUSES = ['active', 'inactive'];

export async function updateServiceStatus(input: UpdateServiceStatusInput): Promise<UpdateServiceStatusResult> {
  const { serviceId, businessId, status } = input;

  if (!VALID_STATUSES.includes(status)) {
    throw new BadRequestError('Invalid status. Must be "active" or "inactive"');
  }

  const service = await Service.findOneAndUpdate(
    { _id: serviceId, businessId },
    { status },
    { new: true },
  );

  if (!service) throw new NotFoundError('Service not found');

  logger.info('Service status updated', { serviceId, businessId, status });

  return { service };
}
