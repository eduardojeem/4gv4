import { PanelAccessState } from '@/components/panel-access-state';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { iconFor, usePanel } from '@/lib/panel';

/**
 * Pantalla de cada sección del panel. El layout ya está listo para todas; el
 * contenido nativo se va sumando sección por sección. Mientras tanto se puede
 * abrir esa misma sección en la web.
 */
export default function PanelSection() {
  const colors = usePalette();
  const { section } = useLocalSearchParams<{ section: string }>();
  const { loading, findItem } = usePanel();
  const item = section ? findItem(section) : undefined;

  if (loading || !item) return <PanelAccessState />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
          <Ionicons name={iconFor(item.key)} size={26} color={palette.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>{item.label}</Text>
          <Text style={[styles.text, { color: colors.muted }]}>{item.description}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="construct-outline" size={22} color={colors.muted} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>Disponible en la web</Text>
        <Text style={[styles.text, { color: colors.muted }]}>
          Esta sección todavía se usa desde la web. Podés abrirla acá mismo: la primera vez te pide iniciar sesión en el navegador.
        </Text>
        <Pressable onPress={() => openWeb(item.href)} style={styles.primary}>
          <Ionicons name="open-outline" size={18} color="#fff" />
          <Text style={styles.primaryText}>Abrir {item.label} en la web</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  text: { fontSize: 14, lineHeight: 20, textAlign: 'left' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 12, paddingVertical: 13, marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
