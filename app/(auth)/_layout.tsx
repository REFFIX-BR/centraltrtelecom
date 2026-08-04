import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/src/theme';

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.primaryDark },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="primeiro-acesso" />
      </Stack>
    </>
  );
}
