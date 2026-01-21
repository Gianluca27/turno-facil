import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore } from '../../shared/stores/authStore';
import { connectWebSocket, disconnectWebSocket } from '../../services/init';

// Auth screens
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen';

// Main app
import { MainTabNavigator } from './MainTabNavigator';

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;

  // Main app
  Main: undefined;

  // Other screens
  AppointmentDetail: { appointmentId: string };
  ClientDetail: { clientId: string };
  StaffDetail: { staffId: string };
  ServiceDetail: { serviceId: string };
  CreateAppointment: undefined;
  CreateStaff: undefined;
  CreateService: undefined;
  Settings: undefined;
  EditProfile: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
          {/* Add other screens here as needed */}
        </>
      )}
    </Stack.Navigator>
  );
};
