import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore } from '../../shared/stores/authStore';
import { connectWebSocket, disconnectWebSocket } from '../../services/init';
import { colors } from '../../shared/theme';

// Auth screens
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen';

// Main app
import { MainTabNavigator } from './MainTabNavigator';

// Feature screens
import { StaffScreen } from '../../features/staff/screens/StaffScreen';
import { FinancesScreen } from '../../features/finances/screens/FinancesScreen';
import { MarketingScreen } from '../../features/marketing/screens/MarketingScreen';
import { AnalyticsScreen } from '../../features/analytics/screens/AnalyticsScreen';
import { ReviewsScreen } from '../../features/reviews/screens/ReviewsScreen';

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  VerifyOTP: { phone: string };

  // Main app
  Main: undefined;

  // Appointments
  AppointmentDetail: { appointmentId: string };
  CreateAppointment: { clientId?: string; staffId?: string; date?: string };
  EditAppointment: { appointmentId: string };

  // Clients
  ClientDetail: { clientId: string };
  CreateClient: undefined;
  ClientAppointments: { clientId: string };

  // Staff
  Staff: undefined;
  StaffDetail: { staffId: string };
  CreateStaff: undefined;
  EditStaff: { staffId: string };
  StaffSchedule: { staffId: string };
  StaffServices: { staffId: string };

  // Services
  ServiceDetail: { serviceId: string };
  CreateService: { categoryId?: string };
  EditService: { serviceId: string };
  ServiceCategories: undefined;
  CreateServiceCategory: undefined;
  EditServiceCategory: { categoryId: string };

  // Finances
  Finances: undefined;
  TransactionHistory: undefined;
  TransactionDetail: { transactionId: string };
  FinanceReports: undefined;
  NewSale: undefined;
  CollectPayment: { appointmentId?: string };
  RegisterExpense: undefined;
  CashRegister: undefined;
  ExpenseHistory: undefined;

  // Marketing
  Marketing: undefined;
  PromotionDetail: { promotionId: string };
  CreatePromotion: { type?: 'percentage' | 'fixed' };
  EditPromotion: { promotionId: string };
  CampaignDetail: { campaignId: string };
  CreateCampaign: { type?: 'push' | 'email' | 'sms' };
  EditCampaign: { campaignId: string };
  AutoNotifications: undefined;

  // Analytics
  Analytics: undefined;
  AnalyticsDetail: { type: string };

  // Reviews
  Reviews: undefined;
  ReviewDetail: { reviewId: string };

  // Settings
  Settings: undefined;
  BusinessInfo: undefined;
  EditBusinessInfo: undefined;
  BusinessSchedule: undefined;
  BookingSettings: undefined;
  PaymentSettings: undefined;
  NotificationSettings: undefined;
  AppearanceSettings: undefined;
  SecuritySettings: undefined;
  ChangePassword: undefined;
  HelpSupport: undefined;
  Team: undefined;
  InviteTeamMember: undefined;
  Integrations: undefined;
  Subscription: undefined;

  // User
  EditProfile: undefined;
  Notifications: undefined;
  SwitchBusiness: undefined;

  // Waitlist
  Waitlist: undefined;
  WaitlistDetail: { entryId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerShown: true,
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTitleStyle: {
    fontWeight: '600' as const,
    fontSize: 18,
    color: colors.text,
  },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
  headerBackTitleVisible: false,
};

export const RootNavigator: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      // Connect to WebSocket when authenticated
      connectWebSocket();
    } else {
      // Disconnect when logged out
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isAuthenticated]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        // Auth screens
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        // Main app screens
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />

          {/* Staff Screens */}
          <Stack.Screen
            name="Staff"
            component={StaffScreen}
            options={{ ...screenOptions, title: 'Empleados' }}
          />

          {/* Finances Screens */}
          <Stack.Screen
            name="Finances"
            component={FinancesScreen}
            options={{ ...screenOptions, title: 'Finanzas' }}
          />

          {/* Marketing Screens */}
          <Stack.Screen
            name="Marketing"
            component={MarketingScreen}
            options={{ ...screenOptions, title: 'Marketing' }}
          />

          {/* Analytics Screens */}
          <Stack.Screen
            name="Analytics"
            component={AnalyticsScreen}
            options={{ ...screenOptions, title: 'Estadísticas' }}
          />

          {/* Reviews Screens */}
          <Stack.Screen
            name="Reviews"
            component={ReviewsScreen}
            options={{ ...screenOptions, title: 'Reseñas' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};
