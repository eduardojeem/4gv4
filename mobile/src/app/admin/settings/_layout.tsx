import { Stack } from 'expo-router';

import { SettingsProvider } from '@/lib/settings-context';

/**
 * Admin → Configuración. Las pantallas comparten lo cargado del servidor (la
 * misma configuración que edita /admin/settings en la web) y navegan en su pila.
 */
export default function SettingsLayout() {
  return (
    <SettingsProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SettingsProvider>
  );
}
