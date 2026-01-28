/**
 * User Types - Shared types for client app users
 */

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_say';
export type UserStatus = 'active' | 'suspended' | 'deleted';
export type ThemePreference = 'light' | 'dark' | 'system';
export type AuthProvider = 'google' | 'facebook' | 'apple';
export type PaymentMethodType = 'card' | 'mercadopago';
export type DevicePlatform = 'ios' | 'android' | 'web' | 'unknown';

export interface AuthProviderInfo {
  provider: AuthProvider;
  providerId: string;
  email?: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  birthDate?: string;
  gender?: Gender;
}

export interface NotificationPreferences {
  push: boolean;
  email: boolean;
  sms: boolean;
  marketing: boolean;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  theme: ThemePreference;
  notifications: NotificationPreferences;
}

export interface PaymentMethod {
  _id: string;
  type: PaymentMethodType;
  last4: string;
  brand?: string;
  externalId: string;
  isDefault: boolean;
}

export interface UserFavorites {
  businesses: string[];
  professionals: string[];
}

export interface UserStats {
  totalAppointments: number;
  totalSpent: number;
  cancelledAppointments: number;
  noShows: number;
}

export interface UserDevice {
  deviceId: string;
  fcmToken: string;
  platform: DevicePlatform;
  lastActive: string;
}

export interface User {
  _id: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  profile: UserProfile;
  authProviders: AuthProviderInfo[];
  preferences: UserPreferences;
  paymentMethods: PaymentMethod[];
  favorites: UserFavorites;
  stats: UserStats;
  status: UserStatus;
  devices: UserDevice[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// API Request/Response Types
export interface RegisterUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PhoneLoginRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
  verificationId: string;
}

export interface SocialLoginRequest {
  provider: AuthProvider;
  token: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthDate?: string;
  gender?: Gender;
}

export interface UpdatePreferencesRequest {
  language?: string;
  timezone?: string;
  theme?: ThemePreference;
  notifications?: Partial<NotificationPreferences>;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}
