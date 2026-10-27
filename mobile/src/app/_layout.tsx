import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { BiometricLockScreen } from '@/components/biometric-lock-screen';
import { apiFetch } from '@/lib/api';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading, locked } = useSession();
  const sessionUserId = session?.user.id ?? null;

  // La pantalla de carga queda hasta saber si hay sesión guardada: así el
  // marketplace ya sabe si mostrar «Ingresar» o «Mi panel».
  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);

  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    apiFetch<{ setupState?: { completed?: boolean } | null }>('/api/onboarding/status')
      .then((status) => {
        if (active && status.setupState && !status.setupState.completed) router.replace('/onboarding' as never);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [sessionUserId]);

  if (isLoading) return null;

  // Como en la web, el inicio es el marketplace público. El panel del comercio
  // solo existe con sesión; el login, solo sin ella.
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="products" />
        <Stack.Screen name="stores" />
        <Stack.Screen name="offers" />
        <Stack.Screen name="saas" />
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="panel" />
          <Stack.Screen name="admin" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
          <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
      {session && locked && <BiometricLockScreen />}
    </>
  );
}
