/**
 * API Types - Common types for API requests and responses
 */

// Generic API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Search/Filter params
export interface SearchParams extends PaginationParams {
  q?: string;
}

export interface DateRangeParams {
  from?: string;
  to?: string;
}

// Business explore params
export interface ExploreBusinessParams extends SearchParams {
  lat?: number;
  lng?: number;
  type?: string;
  rating?: number;
  distance?: number;
  priceRange?: 'low' | 'medium' | 'high';
  hasAvailability?: boolean;
}

// Appointment list params
export interface AppointmentListParams extends PaginationParams, DateRangeParams {
  staffId?: string;
  status?: string;
  view?: 'day' | 'week' | 'month';
}

// Client list params
export interface ClientListParams extends SearchParams {
  segment?: 'all' | 'new' | 'returning' | 'vip' | 'inactive' | 'blocked';
}

// Transaction list params
export interface TransactionListParams extends PaginationParams, DateRangeParams {
  type?: 'payment' | 'refund' | 'expense';
  staffId?: string;
  method?: string;
}

// Analytics params
export interface AnalyticsParams extends DateRangeParams {
  period?: 'day' | 'week' | 'month' | 'year';
  staffId?: string;
  serviceId?: string;
}

// File upload
export interface UploadResponse {
  url: string;
  thumbnail?: string;
  key: string;
}

export interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresAt: string;
}

// WebSocket events
export type WebSocketEvent =
  | 'appointment:new'
  | 'appointment:confirmed'
  | 'appointment:cancelled'
  | 'appointment:rescheduled'
  | 'appointment:updated'
  | 'appointment:reminder'
  | 'client:checkin'
  | 'calendar:refresh'
  | 'waitlist:available'
  | 'notification:new'
  | 'review:new';

export interface WebSocketMessage<T = unknown> {
  event: WebSocketEvent;
  data: T;
  timestamp: string;
}

// Health check
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    queue: 'running' | 'stopped';
  };
}
