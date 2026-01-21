import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

// Initialize MMKV storage
const storage = new MMKV({ id: 'auth-storage' });

interface Business {
  businessId: string;
  role: string;
  permissions: string[];
}

interface User {
  id: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  businesses: Business[];
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  currentBusiness: Business | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (user: User, tokens: Tokens) => void;
  logout: () => void;
  setTokens: (tokens: Tokens) => void;
  setCurrentBusiness: (business: Business) => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  currentBusiness: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      // Restore auth state from storage
      const storedUser = storage.getString('user');
      const storedTokens = storage.getString('tokens');
      const storedCurrentBusiness = storage.getString('currentBusiness');

      if (storedUser && storedTokens) {
        const user = JSON.parse(storedUser) as User;
        const tokens = JSON.parse(storedTokens) as Tokens;
        const currentBusiness = storedCurrentBusiness
          ? JSON.parse(storedCurrentBusiness) as Business
          : user.businesses[0] || null;

        set({
          user,
          tokens,
          currentBusiness,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
      set({ isLoading: false });
    }
  },

  login: (user: User, tokens: Tokens) => {
    // Persist to storage
    storage.set('user', JSON.stringify(user));
    storage.set('tokens', JSON.stringify(tokens));

    // Set default business
    const currentBusiness = user.businesses[0] || null;
    if (currentBusiness) {
      storage.set('currentBusiness', JSON.stringify(currentBusiness));
    }

    set({
      user,
      tokens,
      currentBusiness,
      isAuthenticated: true,
    });
  },

  logout: () => {
    // Clear storage
    storage.delete('user');
    storage.delete('tokens');
    storage.delete('currentBusiness');

    set({
      user: null,
      tokens: null,
      currentBusiness: null,
      isAuthenticated: false,
    });
  },

  setTokens: (tokens: Tokens) => {
    storage.set('tokens', JSON.stringify(tokens));
    set({ tokens });
  },

  setCurrentBusiness: (business: Business) => {
    storage.set('currentBusiness', JSON.stringify(business));
    set({ currentBusiness: business });
  },

  updateUser: (updates: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      storage.set('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },
}));

// Selectors
export const useUser = () => useAuthStore((state) => state.user);
export const useTokens = () => useAuthStore((state) => state.tokens);
export const useCurrentBusiness = () => useAuthStore((state) => state.currentBusiness);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);

// Permission helpers
export const useHasPermission = (permission: string): boolean => {
  const currentBusiness = useCurrentBusiness();

  if (!currentBusiness) return false;
  if (currentBusiness.role === 'owner') return true;
  if (currentBusiness.permissions.includes('*')) return true;
  if (currentBusiness.permissions.includes(permission)) return true;

  // Check wildcard for category
  const [category] = permission.split(':');
  if (currentBusiness.permissions.includes(`${category}:*`)) return true;

  return false;
};

export const useIsOwner = (): boolean => {
  const currentBusiness = useCurrentBusiness();
  return currentBusiness?.role === 'owner';
};
