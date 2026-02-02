import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authStorage as storage } from '../shared/utils/storage';

// Configuration
// Use your local IP for development (run ipconfig to find it)
const DEV_API_HOST = '192.168.100.2';
const API_URL = __DEV__ ? `http://${DEV_API_HOST}:3000/api/v1` : 'https://api.turnofacil.com/api/v1';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const tokensStr = storage.getString('tokens');
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr);
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    // Add business ID if available
    const currentBusinessStr = storage.getString('currentBusiness');
    if (currentBusinessStr) {
      const currentBusiness = JSON.parse(currentBusinessStr);
      config.headers['X-Business-Id'] = currentBusiness.businessId;
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

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const tokensStr = storage.getString('tokens');
        if (tokensStr) {
          const tokens = JSON.parse(tokensStr);

          // Try to refresh token
          const response = await axios.post(`${API_URL}/business-auth/refresh`, {
            refreshToken: tokens.refreshToken,
          });

          const newTokens = response.data.data.tokens;

          // Save new tokens
          storage.set('tokens', JSON.stringify(newTokens));

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        storage.delete('user');
        storage.delete('tokens');
        storage.delete('currentBusiness');

        // Redirect to login (this will be handled by the app state)
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API response types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ user: any; tokens: any }>>('/business-auth/login', { email, password }),

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    businessName: string;
    businessType: string;
  }) => api.post<ApiResponse<{ user: any; tokens: any }>>('/business-auth/register', data),

  logout: (refreshToken?: string) =>
    api.post('/business-auth/logout', { refreshToken }),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ tokens: any }>>('/business-auth/refresh', { refreshToken }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/business-auth/change-password', { currentPassword, newPassword }),
};

// Business API
export const businessApi = {
  get: () => api.get<ApiResponse<{ business: any }>>('/manage/business'),
  update: (data: any) => api.put<ApiResponse<{ business: any }>>('/manage/business', data),
};

// Dashboard API
export const dashboardApi = {
  getOverview: () => api.get<ApiResponse<any>>('/manage/dashboard'),
  getToday: () => api.get<ApiResponse<any>>('/manage/dashboard/today'),
  getStats: (period: string) => api.get<ApiResponse<any>>(`/manage/dashboard/stats?period=${period}`),
};

// Appointments API
export const appointmentsApi = {
  list: (params: { date?: string; from?: string; to?: string; staffId?: string; status?: string }) =>
    api.get<ApiResponse<{ appointments: any[]; pagination: any }>>('/manage/appointments', { params }),

  get: (id: string) => api.get<ApiResponse<{ appointment: any }>>(`/manage/appointments/${id}`),

  create: (data: any) => api.post<ApiResponse<{ appointment: any }>>('/manage/appointments', data),

  confirm: (id: string) => api.post<ApiResponse<{ appointment: any }>>(`/manage/appointments/${id}/confirm`),

  checkIn: (id: string) => api.post<ApiResponse<{ appointment: any }>>(`/manage/appointments/${id}/check-in`),

  start: (id: string) => api.post<ApiResponse<{ appointment: any }>>(`/manage/appointments/${id}/start`),

  complete: (id: string) => api.post<ApiResponse<{ appointment: any }>>(`/manage/appointments/${id}/complete`),

  cancel: (id: string, reason?: string) =>
    api.post<ApiResponse<{ appointment: any }>>(`/manage/appointments/${id}/cancel`, { reason }),

  noShow: (id: string) => api.post<ApiResponse<{ appointment: any }>>(`/manage/appointments/${id}/no-show`),
};

// Staff API
export const staffApi = {
  list: () => api.get<ApiResponse<{ staff: any[] }>>('/manage/staff'),
  get: (id: string) => api.get<ApiResponse<{ staff: any }>>(`/manage/staff/${id}`),
  create: (data: any) => api.post<ApiResponse<{ staff: any }>>('/manage/staff', data),
  update: (id: string, data: any) => api.put<ApiResponse<{ staff: any }>>(`/manage/staff/${id}`, data),
  delete: (id: string) => api.delete(`/manage/staff/${id}`),
  updateSchedule: (id: string, schedule: any) =>
    api.put<ApiResponse<{ staff: any }>>(`/manage/staff/${id}/schedule`, schedule),
  assignServices: (id: string, serviceIds: string[]) =>
    api.put<ApiResponse<{ staff: any }>>(`/manage/staff/${id}/services`, { serviceIds }),
};

// Services API
export const servicesApi = {
  list: () => api.get<ApiResponse<{ services: any[] }>>('/manage/services'),
  get: (id: string) => api.get<ApiResponse<{ service: any }>>(`/manage/services/${id}`),
  create: (data: any) => api.post<ApiResponse<{ service: any }>>('/manage/services', data),
  update: (id: string, data: any) => api.put<ApiResponse<{ service: any }>>(`/manage/services/${id}`, data),
  delete: (id: string) => api.delete(`/manage/services/${id}`),
  toggleStatus: (id: string, status: 'active' | 'inactive') =>
    api.put<ApiResponse<{ service: any }>>(`/manage/services/${id}/status`, { status }),
};

// Clients API
export const clientsApi = {
  list: (params?: { q?: string; segment?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<{ clients: any[]; pagination: any }>>('/manage/clients', { params }),
  get: (id: string) => api.get<ApiResponse<{ client: any }>>(`/manage/clients/${id}`),
  update: (id: string, data: any) => api.put<ApiResponse<{ client: any }>>(`/manage/clients/${id}`, data),
  getAppointments: (id: string) =>
    api.get<ApiResponse<{ appointments: any[] }>>(`/manage/clients/${id}/appointments`),
  block: (id: string, reason?: string) =>
    api.post<ApiResponse<{ client: any }>>(`/manage/clients/${id}/block`, { reason }),
  unblock: (id: string) => api.post<ApiResponse<{ client: any }>>(`/manage/clients/${id}/unblock`),
  toggleVip: (id: string) => api.post<ApiResponse<{ client: any; isVip: boolean }>>(`/manage/clients/${id}/vip`),
};

// Settings API
export const settingsApi = {
  get: () => api.get<ApiResponse<{ settings: any }>>('/manage/settings'),
  updateGeneral: (data: any) => api.put<ApiResponse<{ business: any }>>('/manage/settings/general', data),
  updateSchedule: (data: any) => api.put<ApiResponse<{ schedule: any }>>('/manage/settings/schedule', data),
  updateBooking: (data: any) => api.put<ApiResponse<{ bookingConfig: any }>>('/manage/settings/booking', data),
  updatePayments: (data: any) => api.put<ApiResponse<{ paymentConfig: any }>>('/manage/settings/payments', data),
  updateNotifications: (data: any) => api.put<ApiResponse<{ notifications: any }>>('/manage/settings/notifications', data),
  getSubscription: () => api.get<ApiResponse<{ subscription: any }>>('/manage/settings/subscription'),
};

// Finances API
export const financesApi = {
  getSummary: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/finances/summary', { params: { from, to } }),

  getTransactions: (params: { from?: string; to?: string; type?: string; staffId?: string; limit?: number; page?: number }) =>
    api.get<ApiResponse<{ transactions: any[]; pagination: any }>>('/manage/finances/transactions', { params }),

  createTransaction: (data: any) =>
    api.post<ApiResponse<{ transaction: any }>>('/manage/finances/transactions', data),

  getTransaction: (id: string) =>
    api.get<ApiResponse<{ transaction: any }>>(`/manage/finances/transactions/${id}`),

  // Reports
  getDailyClose: (date?: string) =>
    api.get<ApiResponse<any>>('/manage/finances/reports/daily-close', { params: { date } }),

  getReportByService: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/finances/reports/by-service', { params: { from, to } }),

  getReportByStaff: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/finances/reports/by-staff', { params: { from, to } }),

  getReportByMethod: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/finances/reports/by-method', { params: { from, to } }),

  exportReport: (data: any) =>
    api.post<ApiResponse<{ url: string }>>('/manage/finances/reports/export', data),

  // Expenses
  getExpenses: (params?: { from?: string; to?: string; category?: string }) =>
    api.get<ApiResponse<{ expenses: any[] }>>('/manage/expenses', { params }),

  createExpense: (data: any) =>
    api.post<ApiResponse<{ expense: any }>>('/manage/expenses', data),

  updateExpense: (id: string, data: any) =>
    api.put<ApiResponse<{ expense: any }>>(`/manage/expenses/${id}`, data),

  deleteExpense: (id: string) =>
    api.delete(`/manage/expenses/${id}`),

  // POS
  checkout: (data: any) =>
    api.post<ApiResponse<{ transaction: any }>>('/manage/pos/checkout', data),

  getPendingAppointments: () =>
    api.get<ApiResponse<{ appointments: any[] }>>('/manage/pos/pending'),

  quickSale: (data: any) =>
    api.post<ApiResponse<{ transaction: any }>>('/manage/pos/quick-sale', data),

  getReceipt: (transactionId: string) =>
    api.get<ApiResponse<{ receipt: any }>>(`/manage/pos/receipt/${transactionId}`),

  sendReceipt: (transactionId: string, data: { channel: 'email' | 'sms' | 'whatsapp' }) =>
    api.post<ApiResponse<any>>(`/manage/pos/receipt/${transactionId}/send`, data),

  // Cash Register
  openCashRegister: (data: { initialAmount: number }) =>
    api.post<ApiResponse<{ cashRegister: any }>>('/manage/pos/cash-register/open', data),

  closeCashRegister: (data: { finalAmount: number; notes?: string }) =>
    api.post<ApiResponse<{ cashRegister: any }>>('/manage/pos/cash-register/close', data),

  getCashRegisterStatus: () =>
    api.get<ApiResponse<{ cashRegister: any }>>('/manage/pos/cash-register'),
};

// Analytics API
export const analyticsApi = {
  getOverview: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/analytics/overview', { params: { from, to } }),

  getOccupancy: (params: { from: string; to: string; staffId?: string }) =>
    api.get<ApiResponse<any>>('/manage/analytics/occupancy', { params }),

  getClients: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/analytics/clients', { params: { from, to } }),

  getServices: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/analytics/services', { params: { from, to } }),

  getStaff: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/analytics/staff', { params: { from, to } }),

  getRevenue: (from: string, to: string) =>
    api.get<ApiResponse<any>>('/manage/analytics/revenue', { params: { from, to } }),

  getTrends: (period: 'week' | 'month' | 'year') =>
    api.get<ApiResponse<any>>('/manage/analytics/trends', { params: { period } }),

  getPredictions: () =>
    api.get<ApiResponse<any>>('/manage/analytics/predictions'),
};

// Marketing API
export const marketingApi = {
  // Promotions
  getPromotions: (params?: { status?: string }) =>
    api.get<ApiResponse<{ promotions: any[] }>>('/manage/promotions', { params }),

  getPromotion: (id: string) =>
    api.get<ApiResponse<{ promotion: any }>>(`/manage/promotions/${id}`),

  createPromotion: (data: any) =>
    api.post<ApiResponse<{ promotion: any }>>('/manage/promotions', data),

  updatePromotion: (id: string, data: any) =>
    api.put<ApiResponse<{ promotion: any }>>(`/manage/promotions/${id}`, data),

  deletePromotion: (id: string) =>
    api.delete(`/manage/promotions/${id}`),

  togglePromotionStatus: (id: string, status: 'active' | 'paused') =>
    api.put<ApiResponse<{ promotion: any }>>(`/manage/promotions/${id}/status`, { status }),

  // Campaigns
  getCampaigns: (params?: { status?: string; type?: string }) =>
    api.get<ApiResponse<{ campaigns: any[] }>>('/manage/campaigns', { params }),

  getCampaign: (id: string) =>
    api.get<ApiResponse<{ campaign: any }>>(`/manage/campaigns/${id}`),

  createCampaign: (data: any) =>
    api.post<ApiResponse<{ campaign: any }>>('/manage/campaigns', data),

  updateCampaign: (id: string, data: any) =>
    api.put<ApiResponse<{ campaign: any }>>(`/manage/campaigns/${id}`, data),

  deleteCampaign: (id: string) =>
    api.delete(`/manage/campaigns/${id}`),

  sendCampaign: (id: string) =>
    api.post<ApiResponse<{ campaign: any }>>(`/manage/campaigns/${id}/send`),

  cancelCampaign: (id: string) =>
    api.post<ApiResponse<{ campaign: any }>>(`/manage/campaigns/${id}/cancel`),

  getCampaignStats: (id: string) =>
    api.get<ApiResponse<any>>(`/manage/campaigns/${id}/stats`),

  // Auto Notifications
  getAutoNotifications: () =>
    api.get<ApiResponse<{ config: any }>>('/manage/auto-notifications'),

  updateAutoNotifications: (data: any) =>
    api.put<ApiResponse<{ config: any }>>('/manage/auto-notifications', data),
};

// Reviews API
export const reviewsApi = {
  getStats: () =>
    api.get<ApiResponse<any>>('/manage/reviews/stats'),

  getAll: (params?: { page?: number; limit?: number; filter?: string; staffId?: string }) =>
    api.get<ApiResponse<{ reviews: any[]; pagination: any }>>('/manage/reviews', { params }),

  get: (id: string) =>
    api.get<ApiResponse<{ review: any }>>(`/manage/reviews/${id}`),

  respond: (id: string, text: string) =>
    api.post<ApiResponse<{ review: any }>>(`/manage/reviews/${id}/respond`, { text }),

  updateResponse: (id: string, text: string) =>
    api.put<ApiResponse<{ review: any }>>(`/manage/reviews/${id}/respond`, { text }),

  report: (id: string, reason: string) =>
    api.post<ApiResponse<any>>(`/manage/reviews/${id}/report`, { reason }),
};

// Waitlist API
export const waitlistApi = {
  getAll: (params?: { status?: string }) =>
    api.get<ApiResponse<{ waitlist: any[] }>>('/manage/waitlist', { params }),

  create: (data: any) =>
    api.post<ApiResponse<{ entry: any }>>('/manage/waitlist', data),

  update: (id: string, data: any) =>
    api.put<ApiResponse<{ entry: any }>>(`/manage/waitlist/${id}`, data),

  delete: (id: string) =>
    api.delete(`/manage/waitlist/${id}`),

  notify: (id: string) =>
    api.post<ApiResponse<any>>(`/manage/waitlist/${id}/notify`),
};

// Notifications API
export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number; read?: boolean }) =>
    api.get<ApiResponse<{ notifications: any[]; pagination: any; unreadCount: number }>>('/manage/notifications', { params }),

  markAsRead: (id: string) =>
    api.put<ApiResponse<any>>(`/manage/notifications/${id}/read`),

  markAllAsRead: () =>
    api.put<ApiResponse<any>>('/manage/notifications/read-all'),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/manage/notifications/unread-count'),
};

// Team API (for managing business users)
export const teamApi = {
  getAll: () =>
    api.get<ApiResponse<{ members: any[] }>>('/manage/team'),

  invite: (data: { email: string; role: string; permissions?: string[] }) =>
    api.post<ApiResponse<{ invitation: any }>>('/manage/team/invite', data),

  updateRole: (id: string, role: string, permissions?: string[]) =>
    api.put<ApiResponse<{ member: any }>>(`/manage/team/${id}/role`, { role, permissions }),

  remove: (id: string) =>
    api.delete(`/manage/team/${id}`),

  resendInvite: (id: string) =>
    api.post<ApiResponse<any>>(`/manage/team/${id}/resend-invite`),
};

// Integrations API
export const integrationsApi = {
  getAll: () =>
    api.get<ApiResponse<{ integrations: any[] }>>('/manage/integrations'),

  connectGoogleCalendar: (authCode: string) =>
    api.post<ApiResponse<any>>('/manage/integrations/google-calendar', { authCode }),

  disconnectGoogleCalendar: () =>
    api.delete('/manage/integrations/google-calendar'),

  connectMercadoPago: (authCode: string) =>
    api.post<ApiResponse<any>>('/manage/integrations/mercadopago', { authCode }),

  disconnectMercadoPago: () =>
    api.delete('/manage/integrations/mercadopago'),

  testWebhook: (type: string) =>
    api.post<ApiResponse<any>>('/manage/integrations/test-webhook', { type }),
};

export default api;
