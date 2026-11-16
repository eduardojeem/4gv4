import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

import { usePalette } from '@/lib/palette';

/**
 * Vuelta de Google (`mitiendapy://auth-callback`). La sesión la arma
 * `startGoogleSignIn`, que recibe la URL del navegador; esta pantalla solo
 * existe para que el enlace no caiga en «página no encontrada» y vuelve a
 * donde estaba la persona.
 */
export default function AuthCallbackScreen() {
  const colors = usePalette();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator />
    </View>
  );
}
