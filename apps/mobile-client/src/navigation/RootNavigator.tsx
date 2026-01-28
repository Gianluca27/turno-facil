import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../shared/stores/authStore';
import { colors } from '../shared/theme';
import { RootStackParamList } from './types';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import BookingNavigator from './BookingNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isLoading, setLoading } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize auth state
    const initAuth = async () => {
      try {
        // Check if tokens exist and validate
        const accessToken = useAuthStore.getState().accessToken;
        if (accessToken) {
          // Token exists, user is authenticated
          // Optionally validate token with backend here
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        useAuthStore.getState().logout();
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };

    initAuth();
  }, [setLoading]);

  if (!isReady || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="Booking"
              component={BookingNavigator}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
