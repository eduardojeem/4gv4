import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, usePalette } from '@/lib/palette';

export type SelectOption = { id: string; label: string; hint?: string };

/**
 * Un renglón compacto («Categoría · Fundas ›») que abre una lista con buscador
 * desde abajo. Reemplaza las nubes de chips, que con muchas categorías o marcas
 * ocupaban media pantalla.
 *
 * Con `allowCustom`, lo escrito se puede usar aunque no esté en la lista (una
 * marca nueva, por ejemplo).
 */
export function SelectField({
  label,
  icon,
  value,
  placeholder,
  options,
  onSelect,
  noneLabel,
  allowCustom,
  customLabel = (text) => `Usar «${text}»`,
  onCreate,
  createLabel = (text) => `Crear «${text}»`,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Texto de lo elegido (o null). */
  value: string | null;
  placeholder: string;
  options: SelectOption[];
  /** `id` null = sin elegir; con `allowCustom`, `custom` trae el texto escrito. */
  onSelect: (choice: { id: string | null; label: string | null; custom?: boolean }) => void;
  noneLabel?: string;
  allowCustom?: boolean;
  customLabel?: (text: string) => string;
  /** Si no existe, se crea en el sistema y queda elegida. */
  onCreate?: (text: string) => Promise<SelectOption>;
  createLabel?: (text: string) => string;
}) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((option) => option.label.toLowerCase().includes(q)) : options;
  const exact = options.some((option) => option.label.toLowerCase() === q);

  const close = () => {
    setOpen(false);
    setQuery('');
    setCreateError(null);
  };

  const create = async () => {
    const text = query.trim();
    if (!onCreate || !text || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await onCreate(text);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSelect({ id: created.id, label: created.label });
      close();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear.');
    } finally {
      setCreating(false);
    }
  };

  const pick = (choice: { id: string | null; label: string | null; custom?: boolean }) => {
    void Haptics.selectionAsync();
    onSelect(choice);
    close();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        style={({ pressed }) => [styles.field, { borderColor: colors.border, backgroundColor: pressed ? colors.card : colors.background }]}>
        <View style={[styles.fieldIcon, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
          <Ionicons name={icon} size={16} color={palette.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
          <Text numberOfLines={1} style={[styles.fieldValue, { color: value ? colors.text : colors.muted }]}>{value ?? placeholder}</Text>
        </View>
        {value && noneLabel ? (
          <Pressable onPress={() => onSelect({ id: null, label: null })} hitSlop={10} accessibilityLabel={`Quitar ${label.toLowerCase()}`}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar" />
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.head}>
              <Text style={[styles.title, { color: colors.text }]}>{label}</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>
            <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Buscar ${label.toLowerCase()}`}
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                autoFocus={options.length > 8}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (!query.trim() || exact) return;
                  if (onCreate) void create();
                  else if (allowCustom) pick({ id: null, label: query.trim(), custom: true });
                }}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
                  <Ionicons name="close-circle" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListHeaderComponent={
                <>
                  {onCreate && query.trim() && !exact ? (
                    <Pressable onPress={create} disabled={creating} style={[styles.row, styles.createRow, { borderColor: colors.border }]}>
                      {creating ? <ActivityIndicator size="small" color={palette.primary} /> : <Ionicons name="add-circle" size={20} color={palette.primary} />}
                      <Text numberOfLines={1} style={[styles.rowLabel, styles.bold, { color: palette.primary }]}>{createLabel(query.trim())}</Text>
                    </Pressable>
                  ) : null}
                  {createError ? <Text style={[styles.createError]}>{createError}</Text> : null}
                  {!onCreate && allowCustom && query.trim() && !exact ? (
                    <Row icon="add-circle-outline" label={customLabel(query.trim())} tone={palette.primary} onPress={() => pick({ id: null, label: query.trim(), custom: true })} colors={colors} />
                  ) : null}
                  {noneLabel && !q ? <Row icon="remove-circle-outline" label={noneLabel} selected={!value} onPress={() => pick({ id: null, label: null })} colors={colors} /> : null}
                </>
              }
              ListEmptyComponent={
                !allowCustom && !onCreate ? <Text style={[styles.empty, { color: colors.muted }]}>Nada coincide con «{query}».</Text> : null
              }
              renderItem={({ item }) => (
                <Row label={item.label} hint={item.hint} selected={item.label === value} onPress={() => pick({ id: item.id, label: item.label })} colors={colors} />
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function Row({
  label,
  hint,
  icon,
  selected,
  tone,
  onPress,
  colors,
}: {
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  tone?: string;
  onPress: () => void;
  colors: ReturnType<typeof usePalette>;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={({ pressed }) => [styles.row, { borderColor: colors.border }, pressed && { backgroundColor: colors.background }]}>
      {icon ? <Ionicons name={icon} size={18} color={tone ?? colors.muted} /> : null}
      <Text numberOfLines={1} style={[styles.rowLabel, { color: tone ?? colors.text }, selected && styles.bold]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
      {selected ? <Ionicons name="checkmark" size={20} color={palette.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, minHeight: 54 },
  fieldIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700' },
  fieldValue: { fontSize: 15, fontWeight: '700', marginTop: 1 },
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.45)' },
  sheet: { maxHeight: '80%', minHeight: '45%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 6 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  createRow: { paddingVertical: 15 },
  createError: { color: '#DC2626', fontSize: 13, fontWeight: '600', paddingVertical: 6 },
});
