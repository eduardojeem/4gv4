import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { palette, usePalette } from '@/lib/palette';
import { createPosCustomer, isWholesaleCustomer, PosDuplicateError, searchPosCustomers, type PosCustomer, type PosDuplicate } from '@/lib/pos';

type Colors = ReturnType<typeof usePalette>;

const FIELD: Record<string, string> = { phone: 'teléfono', email: 'email', ruc: 'CI/RUC' };

/**
 * Cliente de la venta: buscar en el padrón o crearlo ahí mismo, sin salir del
 * cobro. El servidor no deja repetir teléfono, email ni CI: si choca, se ofrece
 * usar el cliente que ya existe.
 */
export function PosCustomerSheet({ selected, onClose, onPick }: { selected: PosCustomer | null; onClose: () => void; onPick: (customer: PosCustomer | null) => void }) {
  const colors = usePalette();
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PosCustomer[] | null>(null);

  useEffect(() => {
    if (mode !== 'search') return;
    let active = true;
    const timer = setTimeout(() => {
      searchPosCustomers(query)
        .then((data) => active && setRows(data))
        .catch(() => active && setRows([]));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, mode]);

  if (mode === 'new') {
    return <NewCustomer initial={query} colors={colors} onBack={() => setMode('search')} onClose={onClose} onCreated={onPick} />;
  }

  return (
    <BottomSheet
      visible
      tall
      title="Cliente de la venta"
      subtitle="Opcional. Un cliente mayorista vende a precio mayorista."
      onClose={onClose}
      footer={
        <Pressable onPress={() => setMode('new')} style={[styles.newBtn, { backgroundColor: palette.primary }]}>
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.newText}>{query.trim() && rows?.length === 0 ? `Crear «${query.trim()}»` : 'Cliente nuevo'}</Text>
        </Pressable>
      }>
      <View style={[styles.search, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Nombre, CI/RUC o teléfono" placeholderTextColor={colors.muted} autoFocus autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
      </View>
      {selected && (
        <Pressable onPress={() => onPick(null)} style={[styles.row, { borderColor: colors.border }]}>
          <Ionicons name="close-circle-outline" size={20} color={palette.danger} />
          <Text style={[styles.name, { color: palette.danger }]}>Vender sin cliente</Text>
        </Pressable>
      )}
      {rows === null ? <ActivityIndicator color={palette.primary} /> : null}
      {rows?.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => {
            void Haptics.selectionAsync();
            onPick(row);
          }}
          style={[styles.row, { borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
            <Text style={[styles.avatarText, { color: palette.primary }]}>{row.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]}>{row.name}</Text>
            <Text style={[styles.small, { color: colors.muted }]}>{[row.ruc ? `CI ${row.ruc}` : null, row.phone, row.customer_code].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</Text>
          </View>
          {isWholesaleCustomer(row) && <Text style={[styles.small, styles.wholesale]}>Mayorista</Text>}
          {selected?.id === row.id && <Ionicons name="checkmark" size={20} color={palette.primary} />}
        </Pressable>
      ))}
      {rows?.length === 0 && <Text style={[styles.empty, { color: colors.muted }]}>{query.trim() ? `No hay clientes con «${query.trim()}».` : 'Todavía no hay clientes.'}</Text>}
    </BottomSheet>
  );
}

function NewCustomer({ initial, colors, onBack, onClose, onCreated }: { initial: string; colors: Colors; onBack: () => void; onClose: () => void; onCreated: (customer: PosCustomer) => void }) {
  const numeric = /^[\d\s.\-+()]+$/.test(initial.trim()) && initial.trim() !== '';
  const [name, setName] = useState(numeric ? '' : initial.trim());
  const [phone, setPhone] = useState(numeric && initial.replace(/\D/g, '').startsWith('0') ? initial.trim() : '');
  const [ruc, setRuc] = useState(numeric && !initial.replace(/\D/g, '').startsWith('0') ? initial.trim() : '');
  const [email, setEmail] = useState('');
  const [wholesale, setWholesale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<PosDuplicate[]>([]);
  const [using, setUsing] = useState<string | null>(null);

  const problem = !name.trim() ? 'Escribí el nombre.' : email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? 'Revisá el email.' : null;

  const save = async () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    setDuplicates([]);
    try {
      const created = await createPosCustomer({ name, phone, ruc, email, wholesale });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated(created);
    } catch (err) {
      if (err instanceof PosDuplicateError) setDuplicates(err.duplicates);
      setError(err instanceof Error ? err.message : 'No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const pickExistingCustomer = async (duplicate: PosDuplicate) => {
    setUsing(duplicate.customerId);
    try {
      const rows = await searchPosCustomers(duplicate.value || duplicate.customerName);
      onCreated(rows.find((row) => row.id === duplicate.customerId) ?? { id: duplicate.customerId, name: duplicate.customerName });
    } finally {
      setUsing(null);
    }
  };

  return (
    <BottomSheet
      visible
      title="Cliente nuevo"
      subtitle="Queda en el padrón de clientes y asignado a esta venta."
      onClose={() => !saving && onClose()}
      footer={
        <View style={styles.footer}>
          <Pressable onPress={onBack} style={[styles.backBtn, { borderColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.text }]}>Buscar</Text>
          </Pressable>
          <Pressable onPress={save} disabled={saving} style={[styles.newBtn, styles.flex, { backgroundColor: palette.primary, opacity: saving || problem ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.newText}>Crear y usar</Text>}
          </Pressable>
        </View>
      }>
      <Input label="Nombre y apellido / razón social" value={name} onChangeText={setName} autoFocus={!name} autoCapitalize="words" colors={colors} />
      <View style={styles.pair}>
        <View style={styles.flex}>
          <Input label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="09xx xxx xxx" colors={colors} />
        </View>
        <View style={styles.flex}>
          <Input label="CI / RUC" value={ruc} onChangeText={setRuc} keyboardType="numbers-and-punctuation" colors={colors} />
        </View>
      </View>
      <Input label="Email (opcional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" colors={colors} />
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: colors.text }]}>Cliente mayorista</Text>
          <Text style={[styles.small, { color: colors.muted }]}>Le cobra a precio mayorista</Text>
        </View>
        <Switch value={wholesale} onValueChange={setWholesale} trackColor={{ true: '#7C3AED' }} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {duplicates.map((duplicate) => (
        <View key={`${duplicate.customerId}-${duplicate.field}`} style={[styles.duplicate, { borderColor: '#D9770666', backgroundColor: '#D9770612' }]}>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]}>{duplicate.customerName}</Text>
            <Text style={[styles.small, { color: colors.muted }]}>Ya tiene ese {FIELD[duplicate.field] ?? duplicate.field}: {duplicate.value}</Text>
          </View>
          <Pressable onPress={() => pickExistingCustomer(duplicate)} style={[styles.useBtn, { backgroundColor: palette.primary }]}>
            {using === duplicate.customerId ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.useText}>Usar este</Text>}
          </Pressable>
        </View>
      ))}
    </BottomSheet>
  );
}

function Input({ label, colors, ...props }: React.ComponentProps<typeof TextInput> & { label: string; colors: Colors }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.muted} accessibilityLabel={label} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  small: { fontSize: 12 },
  wholesale: { color: '#7C3AED', fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 11 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: 16 },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, minHeight: 52 },
  newText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 10 },
  backBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: 10 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  duplicate: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  useBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 82, alignItems: 'center' },
  useText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
