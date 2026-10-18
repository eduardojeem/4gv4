import { Ionicons } from '@expo/vector-icons';
import { router, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AdminHeader, AdminMenuProvider, AdminTabBar } from '@/components/admin-chrome';
import { palette, usePalette } from '@/lib/palette';
import { PanelProvider, usePanel } from '@/lib/panel';

/**
 * Área de Administración, aparte del panel como /admin en la web: su propia
 * cabecera, sus pestañas y su menú con las secciones del administrador.
 */
export default function AdminLayout() {
  return (
    <PanelProvider>
      <AdminMenuProvider>
        <StatusBar style="light" />
        <AdminArea />
      </AdminMenuProvider>
    </PanelProvider>
  );
}

function AdminArea() {
  const colors = usePalette();
  const { data, loading, findItem } = usePanel();
  const allowed = Boolean(data?.user.isAdmin || data?.user.isSuperAdmin || findItem('administration'));

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AdminHeader />
      <View style={styles.flex}>
        {loading && !data ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : allowed ? (
          <Slot />
        ) : (
          <View style={styles.center}>
            <Ionicons name="lock-closed-outline" size={34} color={colors.muted} />
            <Text style={[styles.title, { color: colors.text }]}>Solo para administradores</Text>
            <Text style={[styles.text, { color: colors.muted }]}>Tu usuario no tiene acceso a Administración. Pedíselo al dueño del comercio.</Text>
            <Pressable onPress={() => router.replace('/panel' as never)} style={styles.button}>
              <Text style={styles.buttonText}>Volver al panel</Text>
            </Pressable>
          </View>
        )}
      </View>
      {allowed && <AdminTabBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  text: { fontSize: 13, textAlign: 'center' },
  button: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
