import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetServiceInput {
  serviceId: string;
  businessId: string;
}

export interface GetServiceResult {
  service: any;
}

export async function getService(input: GetServiceInput): Promise<GetServiceResult> {
  const service = await Service.findOne({
    _id: input.serviceId,
    businessId: input.businessId,
  });

  if (!service) throw new NotFoundError('Service not found');

  return { service };
}
