import { Stack } from 'expo-router';

import { WebsiteProvider } from '@/lib/website-context';

/**
 * Admin → Sitio web. Las pantallas comparten lo cargado del servidor (la misma
 * configuración que edita /admin/website en la web) y navegan en su propia pila.
 */
export default function WebsiteLayout() {
  return (
    <WebsiteProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </WebsiteProvider>
  );
}
