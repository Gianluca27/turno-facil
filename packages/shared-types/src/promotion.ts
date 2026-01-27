/**
 * Promotion Types - Shared types for promotions and discounts
 */

export type PromotionType = 'percentage' | 'fixed' | 'first_visit' | 'loyalty' | 'package';
export type PromotionStatus = 'draft' | 'active' | 'paused' | 'expired' | 'deleted';
export type ClientSegment = 'all' | 'new' | 'returning' | 'vip' | 'inactive';
export type DiscountType = 'percentage' | 'fixed';

export interface PromotionDiscount {
  type: DiscountType;
  amount: number;
  maxDiscount?: number;
}

export interface PromotionTimeRange {
  from: string;
  to: string;
}

export interface PromotionConditions {
  minPurchase?: number;
  services?: string[];
  staff?: string[];
  daysOfWeek?: number[];
  timeRange?: PromotionTimeRange;
  firstVisitOnly?: boolean;
  minVisits?: number;
  clientSegment?: ClientSegment;
}

export interface PromotionLimits {
  totalUses?: number;
  usesPerClient?: number;
  currentUses: number;
}

export interface Promotion {
  _id: string;
  businessId: string;
  name: string;
  description?: string;
  type: PromotionType;
  code?: string;
  discount: PromotionDiscount;
  conditions: PromotionConditions;
  limits: PromotionLimits;
  validFrom: string;
  validUntil: string;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
}

// API Request Types
export interface CreatePromotionRequest {
  name: string;
  description?: string;
  type: PromotionType;
  code?: string;
  discount: PromotionDiscount;
  conditions?: PromotionConditions;
  limits?: Omit<PromotionLimits, 'currentUses'>;
  validFrom: string;
  validUntil: string;
}

export interface UpdatePromotionRequest {
  name?: string;
  description?: string;
  discount?: Partial<PromotionDiscount>;
  conditions?: Partial<PromotionConditions>;
  limits?: Partial<Omit<PromotionLimits, 'currentUses'>>;
  validFrom?: string;
  validUntil?: string;
  status?: PromotionStatus;
}

export interface ValidateDiscountRequest {
  code: string;
  businessId: string;
  serviceIds: string[];
}

export interface ValidateDiscountResponse {
  valid: boolean;
  promotion?: {
    _id: string;
    name: string;
    discount: PromotionDiscount;
  };
  discountAmount?: number;
  message?: string;
}

// Public promotion info (for client app)
export interface PromotionPublicInfo {
  _id: string;
  name: string;
  description?: string;
  type: PromotionType;
  code?: string;
  discount: PromotionDiscount;
  conditions: Pick<PromotionConditions, 'minPurchase' | 'services' | 'daysOfWeek' | 'timeRange'>;
  validFrom: string;
  validUntil: string;
}
