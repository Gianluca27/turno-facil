import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export interface BookingService {
  _id: string;
  name: string;
  duration: number;
  price: number;
  description?: string;
  image?: string;
  categoryId?: string;
}

export interface BookingStaff {
  _id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  specialties?: string[];
  averageRating?: number;
  totalReviews?: number;
}

export interface BookingBusiness {
  _id: string;
  name: string;
  address: string;
  city: string;
  coverImage?: string;
  requiresDeposit: boolean;
  depositAmount: number;
  depositType: 'fixed' | 'percentage';
  cancellationPolicy: {
    allowCancellation: boolean;
    freeCancellationHours: number;
    penaltyPercentage: number;
  };
  requireConfirmation: boolean;
}

export interface BookingPricing {
  subtotal: number;
  discount: number;
  total: number;
  deposit: number;
}

// ============================================================================
// Store State
// ============================================================================

interface BookingState {
  // Flow data
  business: BookingBusiness | null;
  services: BookingService[];
  staff: BookingStaff | null;
  noStaffPreference: boolean;
  date: string | null;
  startTime: string | null;
  notes: string;
  discountCode: string;
  discountAmount: number;
  pricing: BookingPricing;
  appointmentId: string | null;

  // Actions
  setBusiness: (business: BookingBusiness) => void;
  setServices: (services: BookingService[]) => void;
  setStaff: (staff: BookingStaff | null) => void;
  setDateTime: (date: string, startTime: string) => void;
  setNotes: (notes: string) => void;
  setDiscount: (code: string, amount: number) => void;
  clearDiscount: () => void;
  setPricing: (pricing: BookingPricing) => void;
  setAppointmentId: (id: string) => void;
  reset: () => void;

  // Computed
  totalDuration: () => number;
  serviceIds: () => string[];
  staffId: () => string | undefined;
  requiresPayment: () => boolean;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  business: null,
  services: [],
  staff: null,
  noStaffPreference: true,
  date: null,
  startTime: null,
  notes: '',
  discountCode: '',
  discountAmount: 0,
  pricing: {
    subtotal: 0,
    discount: 0,
    total: 0,
    deposit: 0,
  },
  appointmentId: null,
};

// ============================================================================
// Store
// ============================================================================

export const useBookingStore = create<BookingState>()((set, get) => ({
  ...initialState,

  setBusiness: (business) => set({ business }),

  setServices: (services) => {
    const subtotal = services.reduce((sum, s) => sum + s.price, 0);
    set({
      services,
      pricing: { ...get().pricing, subtotal, total: subtotal - get().discountAmount },
    });
  },

  setStaff: (staff) =>
    set({
      staff,
      noStaffPreference: staff === null,
    }),

  setDateTime: (date, startTime) => set({ date, startTime }),

  setNotes: (notes) => set({ notes }),

  setDiscount: (code, amount) =>
    set((state) => ({
      discountCode: code,
      discountAmount: amount,
      pricing: {
        ...state.pricing,
        discount: amount,
        total: Math.max(0, state.pricing.subtotal - amount),
      },
    })),

  clearDiscount: () =>
    set((state) => ({
      discountCode: '',
      discountAmount: 0,
      pricing: {
        ...state.pricing,
        discount: 0,
        total: state.pricing.subtotal,
      },
    })),

  setPricing: (pricing) => set({ pricing }),

  setAppointmentId: (id) => set({ appointmentId: id }),

  reset: () => set(initialState),

  // Computed helpers
  totalDuration: () => get().services.reduce((sum, s) => sum + s.duration, 0),

  serviceIds: () => get().services.map((s) => s._id),

  staffId: () => {
    const { staff, noStaffPreference } = get();
    return noStaffPreference ? undefined : staff?._id;
  },

  requiresPayment: () => {
    const { business } = get();
    return business?.requiresDeposit === true;
  },
}));
