import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';

export interface ListPosServicesInput {
  businessId: string;
  categoryId?: string;
  search?: string;
}

export interface ListPosServicesResult {
  services: Record<string, unknown>[];
}

export async function listPosServices(input: ListPosServicesInput): Promise<ListPosServicesResult> {
  const { businessId, categoryId, search } = input;

  const query: Record<string, unknown> = {
    businessId,
    status: 'active',
  };

  if (categoryId) {
    query.categoryId = categoryId;
  }

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  const services = await Service.find(query)
    .select('name price duration categoryId')
    .populate('categoryId', 'name')
    .sort({ name: 1 })
    .lean();

  return { services };
}
