import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';

export interface ListServicesInput {
  businessId: string;
}

export interface ListServicesResult {
  services: any[];
}

export async function listServices(input: ListServicesInput): Promise<ListServicesResult> {
  const services = await Service.find({
    businessId: input.businessId,
    status: { $ne: 'deleted' },
  }).sort({ order: 1, name: 1 });

  return { services };
}
