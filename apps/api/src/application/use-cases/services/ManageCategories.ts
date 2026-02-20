import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface ListCategoriesInput {
  businessId: string;
}

export interface ListCategoriesResult {
  categories: any[];
}

export async function listCategories(input: ListCategoriesInput): Promise<ListCategoriesResult> {
  const business = await Business.findById(input.businessId).select('serviceCategories');

  return { categories: business?.serviceCategories || [] };
}

export interface CreateCategoryInput {
  businessId: string;
  name: string;
  description?: string;
}

export interface CreateCategoryResult {
  categories: any[];
}

export async function createCategory(input: CreateCategoryInput): Promise<CreateCategoryResult> {
  const { businessId, name, description } = input;

  const business = await Business.findByIdAndUpdate(
    businessId,
    { $push: { serviceCategories: { name, description, order: 0, isActive: true } } },
    { new: true },
  );

  if (!business) throw new NotFoundError('Business not found');

  logger.info('Service category created', { businessId, name });

  return { categories: business.serviceCategories || [] };
}
