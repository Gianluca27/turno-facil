import { Product } from '../../../infrastructure/database/mongodb/models/Product.js';

export interface ListPosProductsInput {
  businessId: string;
  category?: string;
  search?: string;
}

export interface ListPosProductsResult {
  products: Record<string, unknown>[];
  categories: string[];
}

export async function listPosProducts(input: ListPosProductsInput): Promise<ListPosProductsResult> {
  const { businessId, category, search } = input;

  const query: Record<string, unknown> = {
    businessId,
    status: 'active',
    stock: { $gt: 0 },
  };

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: search },
    ];
  }

  const products = await Product.find(query)
    .select('name sku barcode price stock category images')
    .sort({ name: 1 })
    .lean();

  // Get categories
  const categories = await Product.distinct('category', { businessId, status: 'active' });

  return {
    products,
    categories,
  };
}
