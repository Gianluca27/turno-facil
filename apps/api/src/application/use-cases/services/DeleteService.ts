import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface DeleteServiceInput {
  serviceId: string;
  businessId: string;
}

export async function deleteService(input: DeleteServiceInput): Promise<void> {
  const { serviceId, businessId } = input;

  const service = await Service.findOneAndUpdate(
    { _id: serviceId, businessId },
    { status: 'deleted' },
    { new: true },
  );

  if (!service) throw new NotFoundError('Service not found');

  logger.info('Service deleted (soft)', { serviceId, businessId });
}
