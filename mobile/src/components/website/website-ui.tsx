import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { KeyboardFormScroll } from '../keyboard-form-scroll';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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

const EditorContext = createContext({
  saving: false,
  uploading: false,
  uploadChanged: (_active: boolean) => {},
});
export const useWebsiteEditor = () => useContext(EditorContext);

export type WebsiteIconName = keyof typeof Ionicons.glyphMap;
type IconName = WebsiteIconName;

/** Pantalla del sitio web: barra con Atrás, título, acción a la derecha y contenido con teclado bien manejado. */
export function WebsiteScreen({
  title,
  subtitle,
  right,
  children,
  footer,
  refreshing,
  onRefresh,
  saving = false,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  saving?: boolean;
}) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [uploads, setUploads] = useState(0);
  const uploadChanged = useCallback(
    (active: boolean) =>
      setUploads((value) => Math.max(0, value + (active ? 1 : -1))),
    [],
  );
  usePreventRemove(uploads > 0, () =>
    Alert.alert(
      'Subiendo imagen',
      'Esperá a que termine la subida antes de salir.',
    ),
  );
  useEffect(() => {
    if (saving) Keyboard.dismiss();
  }, [saving]);

  return (
    <EditorContext.Provider
      value={{ saving, uploading: uploads > 0, uploadChanged }}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[
            styles.topBar,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Pressable
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/admin' as never)
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Atrás"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.text }]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={[styles.subtitle, { color: colors.muted }]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
        <View
          style={styles.flex}
          pointerEvents={saving ? 'none' : 'auto'}
          accessibilityElementsHidden={saving}
        >
          <KeyboardFormScroll
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: (footer ? 18 : 34) + insets.bottom },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={Boolean(refreshing)}
                  onRefresh={onRefresh}
                  tintColor={palette.primary}
                />
              ) : undefined
            }
          >
            {children}
          </KeyboardFormScroll>
        </View>
        {footer ? (
          <View
            style={[
              styles.footer,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                paddingBottom: 12 + insets.bottom,
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </EditorContext.Provider>
  );
}

export type PillTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export function StatusPill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: PillTone;
  icon?: IconName;
}) {
  const colors = usePalette();
  const paletteMap: Record<PillTone, { bg: string; fg: string; border: string }> = {
    primary: {
      bg: `${palette.primary}15`,
      fg: palette.primary,
      border: `${palette.primary}35`,
    },
    success: {
      bg: `${palette.success}16`,
      fg: palette.success,
      border: `${palette.success}35`,
    },
    warning: {
      bg: '#FEF3C7',
      fg: '#B45309',
      border: '#FDE68A',
    },
    danger: {
      bg: '#FEE2E2',
      fg: '#B91C1C',
      border: '#FECACA',
    },
    neutral: {
      bg: colors.background,
      fg: colors.muted,
      border: colors.border,
    },
  };
  const scheme = paletteMap[tone];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: scheme.bg, borderColor: scheme.border },
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={scheme.fg} /> : null}
      <Text style={[styles.pillText, { color: scheme.fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({
  progress,
  color = palette.primary,
  height = 7,
}: {
  progress: number;
  color?: string;
  height?: number;
}) {
  const colors = usePalette();
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <View
      style={[
        styles.progressTrack,
        { backgroundColor: colors.border, height, borderRadius: height },
      ]}
    >
      <View
        style={[
          styles.progressFill,
          { backgroundColor: color, width: `${pct}%`, borderRadius: height },
        ]}
      />
    </View>
  );
}

export function SettingsCard({
  icon,
  title,
  hint,
  onPress,
  badge,
  badgeTone = 'neutral',
  locked,
  lockReason,
  accentColor,
}: {
  icon: IconName;
  title: string;
  hint: string;
  onPress: () => void;
  badge?: string;
  badgeTone?: PillTone;
  locked?: boolean;
  lockReason?: string;
  accentColor?: string;
}) {
  const colors = usePalette();
  const iconAccent = locked ? colors.muted : (accentColor ?? palette.primary);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${locked && lockReason ? lockReason : hint}`}
      style={({ pressed }) => [
        styles.navCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: locked ? 0.62 : pressed ? 0.86 : 1,
        },
      ]}
    >
      <View style={[styles.navIcon, { backgroundColor: `${iconAccent}18` }]}>
        <Ionicons name={icon} size={20} color={iconAccent} />
      </View>
      <View style={styles.flex}>
        <View style={styles.navTitleRow}>
          <Text
            numberOfLines={1}
            style={[styles.navTitle, { color: colors.text }]}
          >
            {title}
          </Text>
          {locked ? (
            <StatusPill label="No aplica" tone="neutral" icon="lock-closed-outline" />
          ) : null}
        </View>
        <Text numberOfLines={2} style={[styles.navHint, { color: colors.muted }]}>
          {locked && lockReason ? `Requiere ${lockReason}` : hint}
        </Text>
      </View>
      {badge ? <StatusPill label={badge} tone={badgeTone} /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function Section({
  title,
  hint,
  icon,
  right,
  children,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  right?: ReactNode;
  children: ReactNode;
}) {
  const colors = usePalette();
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.sectionHead}>
        {icon ? (
          <Ionicons name={icon} size={17} color={palette.primary} />
        ) : null}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
        {right}
      </View>
      {hint ? (
        <Text style={[styles.sectionHint, { color: colors.muted }]}>
          {hint}
        </Text>
      ) : null}
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
  showCount,
  icon,
  right,
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
  showCount?: boolean;
  icon?: IconName;
  right?: ReactNode;
  /** Contraseña: oculta lo que se escribe. */
  secure?: boolean;
}) {
  const colors = usePalette();
  const { saving } = useWebsiteEditor();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <View style={styles.labelRight}>
          {showCount && maxLength ? (
            <Text style={[styles.counter, { color: colors.muted }]}>
              {value.length}/{maxLength}
            </Text>
          ) : null}
          {right}
        </View>
      </View>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: error ? palette.danger : colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={16}
            color={colors.muted}
            style={styles.inputIcon}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!saving}
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
          style={[
            styles.input,
            multiline && styles.multiline,
            { color: colors.text },
          ]}
        />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : help ? (
        <Text style={[styles.help, { color: colors.muted }]}>{help}</Text>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
  badge,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  const colors = usePalette();
  const { saving } = useWebsiteEditor();
  return (
    <View
      style={[
        styles.toggleRow,
        { borderColor: colors.border, opacity: disabled ? 0.55 : 1 },
      ]}
    >
      <View style={styles.flex}>
        <View style={styles.navTitleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            {label}
          </Text>
          {badge ? <StatusPill label={badge} tone="primary" /> : null}
        </View>
        {hint ? (
          <Text style={[styles.toggleHint, { color: colors.muted }]}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || saving}
        accessibilityLabel={label}
        trackColor={{ false: colors.border, true: palette.primary }}
      />
    </View>
  );
}

export function ChipSelector<T extends string>({
  options,
  selected,
  onSelect,
  horizontal = false,
}: {
  options: readonly { value: T; label: string; badge?: string }[];
  selected: T;
  onSelect: (value: T) => void;
  horizontal?: boolean;
}) {
  const colors = usePalette();
  const content = options.map((opt) => {
    const active = opt.value === selected;
    return (
      <Pressable
        key={opt.value}
        onPress={() => onSelect(opt.value)}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        style={[
          websiteStyles.chip,
          {
            borderColor: active ? palette.primary : colors.border,
            backgroundColor: active ? `${palette.primary}15` : colors.background,
          },
        ]}
      >
        <Text
          style={[
            websiteStyles.chipText,
            { color: active ? palette.primary : colors.text },
          ]}
        >
          {opt.label}
          {opt.badge ? ` (${opt.badge})` : ''}
        </Text>
      </Pressable>
    );
  });

  if (horizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowHorizontal}
      >
        {content}
      </ScrollView>
    );
  }
  return <View style={styles.chipRowWrap}>{content}</View>;
}

export function ReorderRow({
  onUp,
  onDown,
  onDuplicate,
  onRemove,
  disableUp,
  disableDown,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  const colors = usePalette();
  return (
    <View style={styles.reorderRow}>
      {onUp ? (
        <Pressable
          onPress={onUp}
          disabled={disableUp}
          hitSlop={6}
          accessibilityLabel="Subir"
          style={[
            styles.iconBtn,
            {
              borderColor: colors.border,
              opacity: disableUp ? 0.35 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-up" size={14} color={colors.text} />
        </Pressable>
      ) : null}
      {onDown ? (
        <Pressable
          onPress={onDown}
          disabled={disableDown}
          hitSlop={6}
          accessibilityLabel="Bajar"
          style={[
            styles.iconBtn,
            {
              borderColor: colors.border,
              opacity: disableDown ? 0.35 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-down" size={14} color={colors.text} />
        </Pressable>
      ) : null}
      {onDuplicate ? (
        <Pressable
          onPress={onDuplicate}
          hitSlop={6}
          accessibilityLabel="Duplicar"
          style={[styles.iconBtn, { borderColor: colors.border }]}
        >
          <Ionicons name="copy-outline" size={14} color={palette.primary} />
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={6}
          accessibilityLabel="Quitar"
          style={[styles.iconBtn, { borderColor: '#FECACA' }]}
        >
          <Ionicons name="trash-outline" size={14} color={palette.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Barra inferior Studio: estado en vivo, descartar opcional y Guardar. */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  label = 'Guardar cambios',
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  label?: string;
}) {
  const colors = usePalette();
  const { uploading } = useWebsiteEditor();
  return (
    <View style={styles.saveBar}>
      <View style={styles.saveStatusWrap}>
        <View
          style={[
            styles.saveDot,
            {
              backgroundColor: uploading
                ? palette.primary
                : saving
                  ? palette.primary
                  : dirty
                    ? '#D97706'
                    : palette.success,
            },
          ]}
        />
        <Text
          numberOfLines={1}
          style={[styles.saveState, { color: dirty ? '#B45309' : colors.muted }]}
        >
          {uploading
            ? 'Subiendo imagen…'
            : saving
              ? 'Guardando…'
              : dirty
                ? 'Cambios sin guardar'
                : 'Todo guardado'}
        </Text>
      </View>
      {dirty && onDiscard && !saving && !uploading ? (
        <Pressable
          onPress={onDiscard}
          accessibilityRole="button"
          accessibilityLabel="Descartar cambios"
          style={[styles.discardButton, { borderColor: colors.border }]}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onSave}
        disabled={!dirty || saving || uploading}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.saveButton,
          { opacity: !dirty || saving || uploading ? 0.48 : 1 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveText}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
}

/**
 * Al salir con cambios sin guardar pregunta qué hacer. «Guardar» solo deja salir
 * si el guardado llegó al servidor (`onSave` devuelve true).
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  onSave: () => Promise<boolean>,
  saving = false,
) {
  const navigation = useNavigation();
  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) {
      Alert.alert(
        'Guardando cambios',
        'Esperá a que termine el guardado antes de salir.',
      );
      return;
    }
    // En web Alert.alert no muestra nada: sin esto la pantalla quedaría bloqueada sin aviso.
    if (Platform.OS === 'web') {
      if (
        window.confirm(
          'Tenés cambios sin guardar. Si salís ahora, se pierden. ¿Descartar los cambios?',
        )
      )
        navigation.dispatch(data.action);
      return;
    }
    Alert.alert('Tenés cambios sin guardar', 'Si salís ahora, se pierden.', [
      { text: 'Seguir editando', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
      {
        text: 'Guardar',
        onPress: async () => {
          if (await onSave()) navigation.dispatch(data.action);
        },
      },
    ]);
  });
}

export function StateView({
  icon,
  title,
  text,
  action,
  onAction,
  loading,
}: {
  icon?: IconName;
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  const colors = usePalette();
  return (
    <View style={styles.state}>
      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : (
        <Ionicons
          name={icon ?? 'information-circle-outline'}
          size={34}
          color={colors.muted}
        />
      )}
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {text ? (
        <Text style={[styles.stateText, { color: colors.muted }]}>{text}</Text>
      ) : null}
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={styles.stateButton}
        >
          <Text style={styles.saveText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Notice({
  tone = 'info',
  text,
  actionLabel,
  onAction,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const tones = {
    info: ['#EFF6FF', '#1D4ED8', 'information-circle-outline'],
    warning: ['#FFFBEB', '#B45309', 'alert-circle-outline'],
    danger: ['#FEF2F2', '#B91C1C', 'cloud-offline-outline'],
    success: ['#F0FDF4', '#15803D', 'checkmark-circle-outline'],
  } as const;
  const [bg, fg, icon] = tones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={fg} />
      <View style={styles.flex}>
        <Text style={[styles.noticeText, { color: fg }]}>{text}</Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={6}
            style={{ marginTop: 4, alignSelf: 'flex-start' }}
          >
            <Text style={{ color: fg, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const websiteStyles = StyleSheet.create({
  primaryButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 1 },
  content: { padding: 16, gap: 14 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, fontWeight: '800' },
  progressTrack: { width: '100%', overflow: 'hidden' },
  progressFill: { height: '100%' },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    minHeight: 64,
  },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  navTitle: { fontSize: 15, fontWeight: '800' },
  navHint: { fontSize: 12, marginTop: 2 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  sectionHint: { fontSize: 12, marginTop: -6 },
  field: { gap: 5 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: { fontSize: 13, fontWeight: '700' },
  labelRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counter: { fontSize: 11, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
  },
  inputIcon: { marginLeft: 10 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  error: { color: palette.danger, fontSize: 12, fontWeight: '600' },
  help: { fontSize: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    minHeight: 48,
  },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  toggleHint: { fontSize: 12, marginTop: 1 },
  chipRowHorizontal: { gap: 8, paddingVertical: 2 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveStatusWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  saveDot: { width: 8, height: 8, borderRadius: 4 },
  saveState: { flex: 1, fontSize: 13, fontWeight: '700' },
  discardButton: {
    width: 42,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateText: { fontSize: 13, textAlign: 'center' },
  stateButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 4,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
  },
  noticeText: { fontSize: 13, fontWeight: '600' },
});
