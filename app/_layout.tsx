import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ConnectingSplash } from '@/src/components/ConnectingSplash';
import { AccountProvider, useAccount } from '@/src/contexts/AccountContext';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function AccountGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { isLoading } = useAccount();

  if (isAuthenticated && isLoading) {
    return <ConnectingSplash />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <AccountProvider>
          <AuthGate>
            <AccountGate>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="fatura/[id]" />
                <Stack.Screen name="pagamento/[id]" />
                <Stack.Screen name="perfil/index" />
                <Stack.Screen name="wifi/index" />
                <Stack.Screen name="telefonia/index" />
                <Stack.Screen name="desbloqueio/index" />
                <Stack.Screen name="extrato/index" />
                <Stack.Screen name="documentos/index" />
                <Stack.Screen name="suporte/novo" />
                <Stack.Screen name="suporte/[id]" />
                <Stack.Screen name="notificacoes" />
              </Stack>
            </AccountGate>
          </AuthGate>
        </AccountProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
