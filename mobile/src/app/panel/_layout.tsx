import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';

import { PanelHeader, PanelTabBar } from '@/components/panel-chrome';
import { PanelMenusProvider } from '@/components/panel-menus';
import { usePalette } from '@/lib/palette';
import { PanelProvider } from '@/lib/panel';
import { NotificationsProvider } from '@/lib/notifications-context';

/**
 * Layout del panel, como el dashboard de la web en celular: cabecera con el
 * comercio y el usuario, contenido, y barra inferior con las secciones
 * principales + «Más» (que hace de barra lateral).
 */
export default function PanelLayout() {
  const colors = usePalette();
  const dark = useColorScheme() === 'dark';
  return (
    <PanelProvider>
      <NotificationsProvider>
        <PanelMenusProvider>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <PanelHeader />
            <View style={{ flex: 1 }}>
              <Slot />
            </View>
            <PanelTabBar />
          </View>
        </PanelMenusProvider>
      </NotificationsProvider>
    </PanelProvider>
  );
}
