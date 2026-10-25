import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, usePalette } from '@/lib/palette';

type IconName = keyof typeof Ionicons.glyphMap;

/** Pantalla del sitio web: barra con Atrás, título, acción a la derecha y contenido con teclado bien manejado. */
export function WebsiteScreen({
  title,
  subtitle,
  right,
  children,
  footer,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin' as never))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Atrás"
          style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: (footer ? 16 : 32) + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={palette.primary} /> : undefined}>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.background, paddingBottom: 12 + insets.bottom }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

export function SettingsCard({ icon, title, hint, onPress, badge }: { icon: IconName; title: string; hint: string; onPress: () => void; badge?: string }) {
  const colors = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      style={({ pressed }) => [styles.navCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.navIcon, { backgroundColor: `${palette.primary}18` }]}>
        <Ionicons name={icon} size={20} color={palette.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.navTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.navHint, { color: colors.muted }]}>{hint}</Text>
      </View>
      {badge ? <Text style={[styles.badge, { color: colors.muted, borderColor: colors.border }]}>{badge}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function Section({ title, hint, icon, children }: { title: string; hint?: string; icon?: IconName; children: ReactNode }) {
  const colors = usePalette();
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sectionHead}>
        {icon ? <Ionicons name={icon} size={17} color={palette.primary} /> : null}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {hint ? <Text style={[styles.sectionHint, { color: colors.muted }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  help,
  multiline,
  keyboardType,
  autoCapitalize,
  maxLength,
  icon,
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  help?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  maxLength?: number;
  icon?: IconName;
  /** Contraseña: oculta lo que se escribe. */
  secure?: boolean;
}) {
  const colors = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: error ? palette.danger : colors.border }]}>
        {icon ? <Ionicons name={icon} size={16} color={colors.muted} style={styles.inputIcon} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCapitalize !== 'none'}
          maxLength={maxLength}
          secureTextEntry={secure}
          textContentType={secure ? 'password' : undefined}
          accessibilityLabel={label}
          style={[styles.input, multiline && styles.multiline, { color: colors.text }]}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : help ? <Text style={[styles.help, { color: colors.muted }]}>{help}</Text> : null}
    </View>
  );
}

export function ToggleRow({ label, hint, value, onValueChange, disabled }: { label: string; hint?: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }) {
  const colors = usePalette();
  return (
    <View style={[styles.toggleRow, { borderColor: colors.border, opacity: disabled ? 0.55 : 1 }]}>
      <View style={styles.flex}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[styles.toggleHint, { color: colors.muted }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: colors.border, true: palette.primary }}
      />
    </View>
  );
}

/** Barra inferior: «Cambios sin guardar» y el botón Guardar. */
export function SaveBar({ dirty, saving, onSave, label = 'Guardar cambios' }: { dirty: boolean; saving: boolean; onSave: () => void; label?: string }) {
  const colors = usePalette();
  return (
    <View style={styles.saveBar}>
      <Text style={[styles.saveState, { color: dirty ? '#B45309' : colors.muted }]}>
        {saving ? 'Guardando…' : dirty ? '● Cambios sin guardar' : 'Todo guardado'}
      </Text>
      <Pressable
        onPress={onSave}
        disabled={!dirty || saving}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.saveButton, { opacity: !dirty || saving ? 0.5 : 1 }]}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>{label}</Text>}
      </Pressable>
    </View>
  );
}

/**
 * Al salir con cambios sin guardar pregunta qué hacer. «Guardar» solo deja salir
 * si el guardado llegó al servidor (`onSave` devuelve true).
 */
export function useUnsavedChangesGuard(dirty: boolean, onSave: () => Promise<boolean>) {
  const navigation = useNavigation();
  usePreventRemove(dirty, ({ data }) => {
    // En web Alert.alert no muestra nada: sin esto la pantalla quedaría bloqueada sin aviso.
    if (Platform.OS === 'web') {
      if (window.confirm('Tenés cambios sin guardar. Si salís ahora, se pierden. ¿Descartar los cambios?')) navigation.dispatch(data.action);
      return;
    }
    Alert.alert('Tenés cambios sin guardar', 'Si salís ahora, se pierden.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      {
        text: 'Guardar',
        onPress: async () => {
          if (await onSave()) navigation.dispatch(data.action);
        },
      },
    ]);
  });
}

export function StateView({ icon, title, text, action, onAction, loading }: { icon?: IconName; title: string; text?: string; action?: string; onAction?: () => void; loading?: boolean }) {
  const colors = usePalette();
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator color={palette.primary} /> : <Ionicons name={icon ?? 'information-circle-outline'} size={34} color={colors.muted} />}
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {text ? <Text style={[styles.stateText, { color: colors.muted }]}>{text}</Text> : null}
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={styles.stateButton}>
          <Text style={styles.saveText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Notice({ tone = 'info', text }: { tone?: 'info' | 'warning' | 'danger'; text: string }) {
  const tones = { info: ['#EFF6FF', '#1D4ED8', 'information-circle-outline'], warning: ['#FFFBEB', '#B45309', 'alert-circle-outline'], danger: ['#FEF2F2', '#B91C1C', 'cloud-offline-outline'] } as const;
  const [bg, fg, icon] = tones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={fg} />
      <Text style={[styles.noticeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export const websiteStyles = StyleSheet.create({
  primaryButton: { backgroundColor: palette.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 1 },
  content: { padding: 16, gap: 14 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  navCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, minHeight: 64 },
  navIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 15, fontWeight: '800' },
  navHint: { fontSize: 12, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionHint: { fontSize: 12, marginTop: -6 },
  field: { gap: 5 },
  label: { fontSize: 13, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, minHeight: 44 },
  inputIcon: { marginLeft: 10 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  error: { color: palette.danger, fontSize: 12, fontWeight: '600' },
  help: { fontSize: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, minHeight: 48 },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  toggleHint: { fontSize: 12, marginTop: 1 },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saveState: { flex: 1, fontSize: 13, fontWeight: '700' },
  saveButton: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 18, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  state: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 20 },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateText: { fontSize: 13, textAlign: 'center' },
  stateButton: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12 },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600' },
});
