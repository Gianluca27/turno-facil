/**
 * Service Types - Shared types for business services
 */

export type ServiceStatus = 'active' | 'inactive' | 'deleted';
export type DiscountType = 'percentage' | 'fixed';

export interface ServiceDiscount {
  isActive: boolean;
  type: DiscountType;
  amount: number;
  validFrom?: string;
  validUntil?: string;
}

export interface ServiceAvailability {
  allDays: boolean;
  specificDays?: number[]; // 0-6 (Sunday-Saturday)
  specificHours?: Array<{
    start: string;
    end: string;
  }>;
}

export interface ServiceConfig {
  bufferAfter: number;
  maxPerDay?: number;
  requiresDeposit: boolean;
  depositAmount: number;
  allowOnlineBooking: boolean;
}

export interface PackageService {
  serviceId: string;
  quantity: number;
}

export interface ServiceStats {
  totalBookings: number;
  totalRevenue: number;
}

export interface Service {
  _id: string;
  businessId: string;
  categoryId?: string;
  name: string;
  description?: string;
  duration: number; // minutes
  price: number;
  currency: string;
  config: ServiceConfig;
  availability: ServiceAvailability;
  image?: string;
  gallery?: string[];
  isPackage: boolean;
  packageServices?: PackageService[];
  discount?: ServiceDiscount;
  stats: ServiceStats;
  order: number;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
  // Populated
  category?: {
    _id: string;
    name: string;
  };
}

// API Request Types
export interface CreateServiceRequest {
  categoryId?: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  currency?: string;
  config?: Partial<ServiceConfig>;
  availability?: Partial<ServiceAvailability>;
  image?: string;
  isPackage?: boolean;
  packageServices?: PackageService[];
}

export interface UpdateServiceRequest {
  categoryId?: string;
  name?: string;
  description?: string;
  duration?: number;
  price?: number;
  config?: Partial<ServiceConfig>;
  availability?: Partial<ServiceAvailability>;
  image?: string;
  order?: number;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  order?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

export interface ReorderCategoriesRequest {
  categories: Array<{
    _id: string;
    order: number;
  }>;
}

export interface SetServiceDiscountRequest {
  type: DiscountType;
  amount: number;
  validFrom?: string;
  validUntil?: string;
}
