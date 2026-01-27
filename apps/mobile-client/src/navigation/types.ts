import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Auth Stack
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  PhoneLogin: undefined;
  VerifyOtp: { phone: string; verificationId: string };
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

// Main Tab Navigator
export type MainTabParamList = {
  ExploreTab: undefined;
  AppointmentsTab: undefined;
  FavoritesTab: undefined;
  ProfileTab: undefined;
};

// Explore Stack (within tab)
export type ExploreStackParamList = {
  Explore: undefined;
  Search: { query?: string; category?: string };
  BusinessProfile: { businessId: string; slug?: string };
  BusinessServices: { businessId: string };
  BusinessStaff: { businessId: string };
  BusinessReviews: { businessId: string };
  BusinessGallery: { businessId: string };
  Map: { lat?: number; lng?: number };
};

// Booking Stack
export type BookingStackParamList = {
  SelectServices: { businessId: string };
  SelectStaff: { businessId: string; serviceIds: string[] };
  SelectDateTime: { businessId: string; serviceIds: string[]; staffId?: string };
  BookingConfirmation: {
    businessId: string;
    serviceIds: string[];
    staffId?: string;
    date: string;
    startTime: string;
  };
  BookingSuccess: { appointmentId: string };
  Payment: { appointmentId: string };
};

// Appointments Stack
export type AppointmentsStackParamList = {
  AppointmentsList: undefined;
  AppointmentDetail: { appointmentId: string };
  RescheduleAppointment: { appointmentId: string };
  CancelAppointment: { appointmentId: string };
  WriteReview: { appointmentId: string };
};

// Favorites Stack
export type FavoritesStackParamList = {
  FavoritesList: undefined;
};

// Profile Stack
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  PaymentMethods: undefined;
  AddPaymentMethod: undefined;
  TransactionHistory: undefined;
  MyReviews: undefined;
  Promotions: undefined;
  Settings: undefined;
  Help: undefined;
  About: undefined;
};

// Root Stack
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Booking: NavigatorScreenParams<BookingStackParamList>;
  AppointmentDetail: { appointmentId: string };
  BusinessProfile: { businessId: string; slug?: string };
};

// Screen props types
export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

export type ExploreScreenProps<T extends keyof ExploreStackParamList> = NativeStackScreenProps<
  ExploreStackParamList,
  T
>;

export type BookingScreenProps<T extends keyof BookingStackParamList> = NativeStackScreenProps<
  BookingStackParamList,
  T
>;

export type AppointmentsScreenProps<T extends keyof AppointmentsStackParamList> = NativeStackScreenProps<
  AppointmentsStackParamList,
  T
>;

export type ProfileScreenProps<T extends keyof ProfileStackParamList> = NativeStackScreenProps<
  ProfileStackParamList,
  T
>;

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

// Declaration merge for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
