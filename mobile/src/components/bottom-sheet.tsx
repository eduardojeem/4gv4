import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '@/lib/palette';

/** Hoja que sube desde abajo, con título, contenido desplazable y pie fijo. */
export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  footer,
  children,
  tall,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Para listas largas: la hoja arranca alta aunque tenga poco contenido. */
  tall?: boolean;
}) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={`Cerrar ${title}`} />
        <View style={[styles.sheet, tall && styles.tall, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.45)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8 },
  tall: { height: '85%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  body: { gap: 12, paddingBottom: 12 },
});
