import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../shared/stores/authStore';

const API_URL = __DEV__ ? 'http://localhost:3000/api/v1' : 'https://api.turnofacil.com/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) {
          useAuthStore.getState().logout();
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        useAuthStore.getState().setTokens(accessToken, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// AUTH API
// ============================================================================
export const authApi = {
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    api.post<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>>('/auth/login', data),

  loginWithPhone: (data: { phone: string }) =>
    api.post<ApiResponse<{ verificationId: string }>>('/auth/login/phone', data),

  verifyOtp: (data: { phone: string; code: string; verificationId: string }) =>
    api.post<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>>('/auth/verify-otp', data),

  socialLogin: (data: { provider: 'google' | 'facebook' | 'apple'; token: string }) =>
    api.post<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>>('/auth/social', data),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/refresh', { refreshToken }),

  logout: () => api.post('/auth/logout'),

  forgotPassword: (email: string) =>
    api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; password: string }) =>
    api.post<ApiResponse<{ message: string }>>('/auth/reset-password', data),
};

// ============================================================================
// USER API
// ============================================================================
export const userApi = {
  getProfile: () => api.get<ApiResponse<{ user: any }>>('/users/me'),

  updateProfile: (data: Partial<{ firstName: string; lastName: string; phone: string; birthDate: string }>) =>
    api.put<ApiResponse<{ user: any }>>('/users/me', data),

  updateAvatar: (formData: FormData) =>
    api.put<ApiResponse<{ avatarUrl: string }>>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updatePreferences: (preferences: any) =>
    api.put<ApiResponse<{ user: any }>>('/users/me/preferences', preferences),

  deleteAccount: () => api.delete('/users/me'),

  getNotifications: (params?: { page?: number; limit?: number; read?: boolean }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>('/users/me/notifications', { params }),

  markNotificationRead: (notificationId: string) =>
    api.put(`/users/me/notifications/${notificationId}/read`),

  markAllNotificationsRead: () =>
    api.put('/users/me/notifications/read-all'),

  getPaymentMethods: () =>
    api.get<ApiResponse<{ paymentMethods: any[] }>>('/users/me/payment-methods'),

  addPaymentMethod: (data: any) =>
    api.post<ApiResponse<{ paymentMethod: any }>>('/users/me/payment-methods', data),

  deletePaymentMethod: (paymentMethodId: string) =>
    api.delete(`/users/me/payment-methods/${paymentMethodId}`),

  getTransactionHistory: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>('/users/me/transactions', { params }),
};

// ============================================================================
// EXPLORE API
// ============================================================================
export const exploreApi = {
  searchBusinesses: (params: {
    q?: string;
    lat?: number;
    lng?: number;
    type?: string;
    rating?: number;
    distance?: number;
    priceRange?: string;
    hasAvailability?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<ApiResponse<PaginatedResponse<any>>>('/explore/businesses', { params }),

  getFeaturedBusinesses: () =>
    api.get<ApiResponse<{ businesses: any[] }>>('/explore/businesses/featured'),

  getNearbyBusinesses: (params: { lat: number; lng: number; distance?: number }) =>
    api.get<ApiResponse<{ businesses: any[] }>>('/explore/businesses/nearby', { params }),

  getRecommendedBusinesses: () =>
    api.get<ApiResponse<{ businesses: any[] }>>('/explore/businesses/recommended'),

  getCategories: () =>
    api.get<ApiResponse<{ categories: any[] }>>('/explore/categories'),
};

// ============================================================================
// BUSINESS API (Public)
// ============================================================================
export const businessApi = {
  getBySlug: (slug: string) =>
    api.get<ApiResponse<{ business: any }>>(`/businesses/${slug}`),

  getById: (id: string) =>
    api.get<ApiResponse<{ business: any }>>(`/businesses/${id}`),

  getServices: (businessId: string) =>
    api.get<ApiResponse<{ services: any[]; categories: any[] }>>(`/businesses/${businessId}/services`),

  getStaff: (businessId: string) =>
    api.get<ApiResponse<{ staff: any[] }>>(`/businesses/${businessId}/staff`),

  getReviews: (businessId: string, params?: { page?: number; limit?: number; rating?: number }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>(`/businesses/${businessId}/reviews`, { params }),

  getAvailability: (businessId: string, params: { date: string; serviceIds: string[]; staffId?: string }) =>
    api.get<ApiResponse<{ slots: any[] }>>(`/businesses/${businessId}/availability`, { params }),

  getPromotions: (businessId: string) =>
    api.get<ApiResponse<{ promotions: any[] }>>(`/businesses/${businessId}/promotions`),

  addToFavorites: (businessId: string) =>
    api.post(`/businesses/${businessId}/favorite`),

  removeFromFavorites: (businessId: string) =>
    api.delete(`/businesses/${businessId}/favorite`),
};

// ============================================================================
// BOOKING API
// ============================================================================
export const bookingApi = {
  create: (data: {
    businessId: string;
    services: { serviceId: string; quantity?: number }[];
    staffId?: string;
    date: string;
    startTime: string;
    notes?: string;
    discountCode?: string;
  }) => api.post<ApiResponse<{ appointment: any }>>('/bookings', data),

  getById: (bookingId: string) =>
    api.get<ApiResponse<{ appointment: any }>>(`/bookings/${bookingId}`),

  update: (bookingId: string, data: any) =>
    api.put<ApiResponse<{ appointment: any }>>(`/bookings/${bookingId}`, data),

  cancel: (bookingId: string, data?: { reason?: string }) =>
    api.post<ApiResponse<{ appointment: any }>>(`/bookings/${bookingId}/cancel`, data),

  reschedule: (bookingId: string, data: { date: string; startTime: string }) =>
    api.post<ApiResponse<{ appointment: any }>>(`/bookings/${bookingId}/reschedule`, data),

  checkAvailability: (data: {
    businessId: string;
    serviceIds: string[];
    staffId?: string;
    date: string;
    startTime: string;
  }) => api.post<ApiResponse<{ available: boolean; reason?: string }>>('/bookings/check-availability', data),

  calculatePrice: (data: {
    businessId: string;
    serviceIds: string[];
    discountCode?: string;
  }) => api.post<ApiResponse<{ subtotal: number; discount: number; total: number }>>('/bookings/calculate-price', data),

  getPaymentInfo: (bookingId: string) =>
    api.get<ApiResponse<{ paymentInfo: any }>>(`/bookings/${bookingId}/payment`),

  processPayment: (bookingId: string, data: { paymentMethodId?: string; method: string }) =>
    api.post<ApiResponse<{ transaction: any }>>(`/bookings/${bookingId}/payment`, data),
};

// ============================================================================
// APPOINTMENTS API (User's appointments)
// ============================================================================
export const appointmentsApi = {
  getUpcoming: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>('/users/me/appointments', {
      params: { ...params, status: 'upcoming' },
    }),

  getPast: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>('/users/me/appointments', {
      params: { ...params, status: 'past' },
    }),

  getCancelled: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>('/users/me/appointments', {
      params: { ...params, status: 'cancelled' },
    }),

  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>('/users/me/appointments', { params }),
};

// ============================================================================
// WAITLIST API
// ============================================================================
export const waitlistApi = {
  join: (data: {
    businessId: string;
    services: string[];
    staffId?: string;
    dateRange: { from: string; to: string };
    timeRange?: { from: string; to: string };
    daysOfWeek?: number[];
  }) => api.post<ApiResponse<{ waitlistEntry: any }>>('/waitlist', data),

  getMyEntries: () =>
    api.get<ApiResponse<{ entries: any[] }>>('/waitlist/me'),

  cancel: (waitlistId: string) =>
    api.delete(`/waitlist/${waitlistId}`),

  acceptSlot: (notificationId: string) =>
    api.post<ApiResponse<{ appointment: any }>>(`/waitlist/${notificationId}/accept`),

  declineSlot: (notificationId: string) =>
    api.post(`/waitlist/${notificationId}/decline`),
};

// ============================================================================
// REVIEWS API
// ============================================================================
export const reviewsApi = {
  create: (data: {
    businessId: string;
    appointmentId: string;
    ratings: { overall: number; service?: number; staff?: number; cleanliness?: number; value?: number };
    text?: string;
    photos?: string[];
  }) => api.post<ApiResponse<{ review: any }>>('/reviews', data),

  update: (reviewId: string, data: { text?: string; ratings?: any }) =>
    api.put<ApiResponse<{ review: any }>>(`/reviews/${reviewId}`, data),

  delete: (reviewId: string) =>
    api.delete(`/reviews/${reviewId}`),

  markHelpful: (reviewId: string) =>
    api.post(`/reviews/${reviewId}/helpful`),

  report: (reviewId: string, data: { reason: string }) =>
    api.post(`/reviews/${reviewId}/report`, data),

  getMyReviews: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<PaginatedResponse<any>>>('/users/me/reviews', { params }),
};

// ============================================================================
// PROMOTIONS API
// ============================================================================
export const promotionsApi = {
  getAvailable: (params?: { businessId?: string }) =>
    api.get<ApiResponse<{ promotions: any[] }>>('/promotions', { params }),

  validateCode: (data: { code: string; businessId: string; serviceIds?: string[] }) =>
    api.post<ApiResponse<{ valid: boolean; promotion?: any; discount?: number }>>('/promotions/validate', data),
};

// ============================================================================
// FAVORITES API
// ============================================================================
export const favoritesApi = {
  getBusinesses: () =>
    api.get<ApiResponse<{ businesses: any[] }>>('/users/me/favorites'),

  addBusiness: (businessId: string) =>
    api.post(`/businesses/${businessId}/favorite`),

  removeBusiness: (businessId: string) =>
    api.delete(`/businesses/${businessId}/favorite`),
};

export default api;
