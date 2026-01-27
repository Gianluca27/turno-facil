import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};

export interface User {
  id: string;
  email: string;
  phone?: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    birthDate?: string;
  };
  preferences: {
    language: string;
    theme: 'light' | 'dark' | 'system';
    notifications: {
      push: boolean;
      email: boolean;
      sms: boolean;
      marketing: boolean;
    };
  };
  favorites: {
    businesses: string[];
    professionals: string[];
  };
  stats: {
    totalAppointments: number;
    totalSpent: number;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  addFavoriteBusiness: (businessId: string) => void;
  removeFavoriteBusiness: (businessId: string) => void;
  addFavoriteProfessional: (professionalId: string) => void;
  removeFavoriteProfessional: (professionalId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      setAccessToken: (accessToken) =>
        set({
          accessToken,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      addFavoriteBusiness: (businessId) =>
        set((state) => {
          if (!state.user) return state;
          const businesses = state.user.favorites.businesses.includes(businessId)
            ? state.user.favorites.businesses
            : [...state.user.favorites.businesses, businessId];
          return {
            user: {
              ...state.user,
              favorites: { ...state.user.favorites, businesses },
            },
          };
        }),

      removeFavoriteBusiness: (businessId) =>
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              favorites: {
                ...state.user.favorites,
                businesses: state.user.favorites.businesses.filter((id) => id !== businessId),
              },
            },
          };
        }),

      addFavoriteProfessional: (professionalId) =>
        set((state) => {
          if (!state.user) return state;
          const professionals = state.user.favorites.professionals.includes(professionalId)
            ? state.user.favorites.professionals
            : [...state.user.favorites.professionals, professionalId];
          return {
            user: {
              ...state.user,
              favorites: { ...state.user.favorites, professionals },
            },
          };
        }),

      removeFavoriteProfessional: (professionalId) =>
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              favorites: {
                ...state.user.favorites,
                professionals: state.user.favorites.professionals.filter((id) => id !== professionalId),
              },
            },
          };
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
