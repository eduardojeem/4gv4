import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { BiometricLockScreen } from '@/components/biometric-lock-screen';
import { apiFetch } from '@/lib/api';
import { takePostAuthRoute } from '@/lib/post-auth-route';
import { useMobileRegionalSettings } from '@/lib/regional-settings-sync';
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
  useMobileRegionalSettings();
  const sessionUserId = session?.user.id ?? null;

  // La pantalla de carga queda hasta saber si hay sesión guardada: así el
  // marketplace ya sabe si mostrar «Ingresar» o «Mi panel».
  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);

  // Lo que pidió la pantalla que abrió Google (p. ej. «Crear mi comercio»). Se
  // navega después del cambio de pantallas que dispara la sesión nueva, que si
  // no lo pisaba y la persona terminaba en el marketplace sin su comercio.
  useEffect(() => {
    if (!sessionUserId || locked) return;
    const route = takePostAuthRoute();
    if (!route) return;
    const timer = setTimeout(() => router.replace(route as never), 0);
    return () => clearTimeout(timer);
  }, [sessionUserId, locked]);

  useEffect(() => {
    if (!sessionUserId || locked) return;
    let active = true;
    apiFetch<{blocked?:boolean;canRenew?:boolean}>('/api/subscription/access')
      .catch(()=>null)
      .then(async access=>{
        if(!active)return null;
        if(access?.blocked===true&&access.canRenew===true){router.replace('/admin/subscriptions');return null;}
        return apiFetch<{ setupState?: { completed?: boolean } | null }>('/api/onboarding/status');
      })
      .then((status) => {
        if (active && status?.setupState && !status.setupState.completed) router.replace('/onboarding' as never);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [sessionUserId, locked]);

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
          <Stack.Screen name="delete-account" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="mis-pedidos" />
          <Stack.Screen name="mis-turnos" />
          <Stack.Screen name="mi-cuenta" />
          <Stack.Screen name="create-company" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
          <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
          <Stack.Screen name="join" />
          <Stack.Screen name="register-customer" />
          <Stack.Screen name="captcha" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
      {session && locked && <BiometricLockScreen />}
    </>
  );
}
