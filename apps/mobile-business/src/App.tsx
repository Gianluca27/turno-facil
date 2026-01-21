import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { theme } from './shared/theme';
import { useAuthStore } from './shared/stores/authStore';
import { RootNavigator } from './app/navigation/RootNavigator';
import { initializeServices } from './services/init';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  },
});

function App(): React.JSX.Element {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    // Initialize services and restore auth state
    initializeServices();
    initialize();
  }, [initialize]);

  if (isLoading) {
    // Could return a splash screen here
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <NavigationContainer>
              <StatusBar
                barStyle="dark-content"
                backgroundColor={theme.colors.background}
              />
              <RootNavigator />
            </NavigationContainer>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
