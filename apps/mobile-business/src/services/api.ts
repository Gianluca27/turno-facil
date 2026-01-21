import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { MMKV } from 'react-native-mmkv';

// Configuration
const API_URL = __DEV__ ? 'http://localhost:3000/api/v1' : 'https://api.turnofacil.com/api/v1';

// Storage for tokens
const storage = new MMKV({ id: 'auth-storage' });

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
  getSubscription: () => api.get<ApiResponse<{ subscription: any }>>('/manage/settings/subscription'),
};

export default api;
