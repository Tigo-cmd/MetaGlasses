import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlertProvider, AuthProvider } from '@/template';
import { GlassesProvider } from '@/context/GlassesContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <GlassesProvider>
        <AlertProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0a' },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="media/[id]"
                options={{
                  headerShown: true,
                  headerStyle: { backgroundColor: '#0a0a0a' },
                  headerTintColor: '#fff',
                  headerTitle: '',
                  presentation: 'modal',
                }}
              />
            </Stack>
          </SafeAreaProvider>
        </AlertProvider>
      </GlassesProvider>
    </AuthProvider>
  );
}
