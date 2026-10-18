import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import {
  createRepairCustomer,
  DuplicateCustomerError,
  findCustomerById,
  isWholesale,
  searchRepairCustomers,
  type CustomerDuplicate,
  type NewCustomerInput,
  type RepairCustomer,
} from '@/lib/repairs';

type Colors = ReturnType<typeof usePalette>;

const FIELD_LABEL: Record<string, string> = { phone: 'teléfono', email: 'email', ruc: 'CI/RUC' };

/** Qué tipo de búsqueda es, para decirle a la persona por qué campo se está buscando. */
function searchKind(query: string) {
  const q = query.trim();
  if (!q) return null;
  if (q.includes('@')) return 'por email';
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 6 && digits.length === q.replace(/[\s.\-+()]/g, '').length) return digits.startsWith('0') || digits.startsWith('595') ? 'por teléfono' : 'por CI/RUC o teléfono';
  if (/^[a-z]{1,4}-?\d+$/i.test(q)) return 'por código';
  return 'por nombre';
}

/** Resalta en negrita la parte del texto que coincide con la búsqueda. */
function Highlight({ text, query, style, strong }: { text: string; query: string; style: object; strong: object }) {
  const q = query.trim();
  const index = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index < 0) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {text.slice(0, index)}
      <Text style={strong}>{text.slice(index, index + q.length)}</Text>
      {text.slice(index + q.length)}
    </Text>
  );
}

/**
 * Elegir el cliente de una reparación: busca en todo el padrón (nombre, CI/RUC,
 * teléfono, email o código) y muestra lo suficiente para no confundir a dos
 * «Juan Pérez». Si no existe, se crea ahí mismo; si el teléfono, email o CI ya
 * son de otro cliente, ofrece usar ese en vez de duplicarlo.
 */
export function CustomerPicker({
  value,
  onChange,
  error,
}: {
  value: RepairCustomer | null;
  onChange: (customer: RepairCustomer | null) => void;
  error?: string | null;
}) {
  const colors = usePalette();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RepairCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (value || creating) return;
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchRepairCustomers(query)
        .then((rows) => active && setResults(rows.slice(0, query.trim() ? 12 : 6)))
        .catch(() => active && setResults([]))
        .finally(() => active && setSearching(false));
    }, query.trim() ? 350 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, value, creating]);

  if (value) return <SelectedCustomer customer={value} colors={colors} onClear={() => onChange(null)} />;

  if (creating) {
    return (
      <NewCustomerForm
        colors={colors}
        initial={query}
        onCancel={() => setCreating(false)}
        onCreated={(customer) => {
          setCreating(false);
          setQuery('');
          onChange(customer);
        }}
      />
    );
  }

  const kind = searchKind(query);

  return (
    <View style={styles.stack}>
      <View style={[styles.search, { borderColor: error ? palette.danger : colors.border, backgroundColor: colors.background }]}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Nombre, CI/RUC, teléfono, email o código"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Buscar cliente"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {searching ? (
          <ActivityIndicator size="small" color={colors.muted} />
        ) : query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
            <Ionicons name="close-circle" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.caption, { color: colors.muted }]}>
        {query.trim()
          ? searching
            ? `Buscando ${kind}…`
            : `${results.length === 0 ? 'Ningún cliente' : `${results.length} ${results.length === 1 ? 'cliente' : 'clientes'}`} ${kind}`
          : 'Clientes recientes'}
      </Text>

      {results.map((customer) => (
        <CustomerRow key={customer.id} customer={customer} query={query} colors={colors} onPress={() => onChange(customer)} />
      ))}

      <Pressable onPress={() => setCreating(true)} style={[styles.newBtn, { borderColor: palette.primary }]}>
        <Ionicons name="person-add-outline" size={17} color={palette.primary} />
        <Text style={[styles.newText, { color: palette.primary }]}>
          {query.trim() && results.length === 0 ? `Crear cliente «${query.trim()}»` : 'Cliente nuevo'}
        </Text>
      </Pressable>
    </View>
  );
}

function CustomerRow({ customer, query, colors, onPress }: { customer: RepairCustomer; query: string; colors: Colors; onPress: () => void }) {
  const details = [
    customer.ruc ? `CI/RUC ${customer.ruc}` : null,
    customer.phone,
    customer.email,
  ].filter(Boolean) as string[];
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}${customer.ruc ? `, CI ${customer.ruc}` : ''}${customer.phone ? `, ${customer.phone}` : ''}`}
      style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: pressed ? colors.background : colors.card }]}>
      <View style={[styles.avatar, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
        <Text style={[styles.avatarText, { color: palette.primary }]}>{customer.name.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Highlight text={customer.name} query={query} style={[styles.name, { color: colors.text }]} strong={{ color: palette.primary }} />
          {isWholesale(customer) && <Badge label="Mayorista" color="#7C3AED" />}
          {customer.customer_type === 'empresa' && <Badge label="Empresa" color="#0891B2" />}
          {customer.status === 'inactive' && <Badge label="Inactivo" color="#64748B" />}
        </View>
        {details.map((detail) => (
          <Highlight key={detail} text={detail} query={query} style={[styles.detail, { color: colors.muted }]} strong={{ color: colors.text, fontWeight: '800' }} />
        ))}
        {(customer.customer_code || customer.city) && (
          <Text style={[styles.detail, { color: colors.muted }]}>{[customer.customer_code, customer.city].filter(Boolean).join(' · ')}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

function SelectedCustomer({ customer, colors, onClear }: { customer: RepairCustomer; colors: Colors; onClear: () => void }) {
  return (
    <View style={[styles.selected, { borderColor: palette.primary, backgroundColor: 'rgba(37,99,235,0.07)' }]}>
      <View style={[styles.avatar, styles.avatarLg, { backgroundColor: palette.primary }]}>
        <Text style={[styles.avatarText, { color: '#fff', fontSize: 18 }]}>{customer.name.trim().charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]}>{customer.name}</Text>
          {isWholesale(customer) && <Badge label="Mayorista" color="#7C3AED" />}
        </View>
        {customer.ruc ? <Info icon="card-outline" text={`CI/RUC ${customer.ruc}`} colors={colors} /> : null}
        {customer.phone ? <Info icon="call-outline" text={customer.phone} colors={colors} /> : <Info icon="call-outline" text="Sin teléfono" colors={colors} muted />}
        {customer.alternate_phone ? (
          <Info icon="people-outline" text={`${customer.alternate_phone}${customer.alternate_phone_label ? ` (${customer.alternate_phone_label})` : ''}`} colors={colors} />
        ) : null}
        {customer.email ? <Info icon="mail-outline" text={customer.email} colors={colors} /> : null}
        {isWholesale(customer) && <Text style={[styles.detail, { color: '#7C3AED' }]}>Los repuestos del inventario se cotizan a precio mayorista.</Text>}
      </View>
      <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cambiar cliente">
        <Text style={[styles.change, { color: palette.primary }]}>Cambiar</Text>
      </Pressable>
    </View>
  );
}

function NewCustomerForm({ colors, initial, onCancel, onCreated }: { colors: Colors; initial: string; onCancel: () => void; onCreated: (customer: RepairCustomer) => void }) {
  const looksNumeric = /^[\d\s.\-+()]+$/.test(initial.trim()) && initial.trim() !== '';
  const [form, setForm] = useState<NewCustomerInput>(() => ({
    name: looksNumeric || initial.includes('@') ? '' : initial.trim(),
    phone: looksNumeric ? initial.trim() : '',
    email: initial.includes('@') ? initial.trim() : '',
    ruc: '',
    alternatePhone: '',
    alternatePhoneLabel: '',
    city: '',
    companyName: '',
  }));
  const [isCompany, setIsCompany] = useState(false);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<CustomerDuplicate[]>([]);
  const [usingId, setUsingId] = useState<string | null>(null);

  const set = (key: keyof NewCustomerInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDuplicates([]);
  };

  const emailInvalid = Boolean(form.email?.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email!.trim());
  const problem = !form.name.trim() ? 'Escribí el nombre.' : !form.phone?.trim() && !form.ruc?.trim() ? 'Cargá al menos teléfono o CI/RUC para ubicarlo después.' : emailInvalid ? 'Revisá el email.' : null;

  const save = async () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const created = await createRepairCustomer({ ...form, companyName: isCompany ? form.name : undefined });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated(created);
    } catch (err) {
      if (err instanceof DuplicateCustomerError) {
        setDuplicates(err.duplicates);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo crear el cliente.');
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setSaving(false);
    }
  };

  const pickExisting = async (duplicate: CustomerDuplicate) => {
    setUsingId(duplicate.customerId);
    try {
      const customer = await findCustomerById(duplicate.customerId, duplicate.value || duplicate.customerName);
      onCreated(customer ?? { id: duplicate.customerId, name: duplicate.customerName, phone: duplicate.phone, email: duplicate.email, ruc: duplicate.ruc });
    } finally {
      setUsingId(null);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.chips}>
        <Toggle label="Persona" icon="person-outline" selected={!isCompany} onPress={() => setIsCompany(false)} colors={colors} />
        <Toggle label="Empresa" icon="business-outline" selected={isCompany} onPress={() => setIsCompany(true)} colors={colors} />
      </View>
      <Input label={isCompany ? 'Razón social' : 'Nombre y apellido'} value={form.name} onChangeText={(v) => set('name', v)} colors={colors} autoCapitalize="words" autoFocus={!form.name} />
      <View style={styles.pair}>
        <View style={styles.flex}>
          <Input label={isCompany ? 'RUC' : 'CI / RUC'} value={form.ruc ?? ''} onChangeText={(v) => set('ruc', v)} colors={colors} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={styles.flex}>
          <Input label="Teléfono" value={form.phone ?? ''} onChangeText={(v) => set('phone', v)} colors={colors} keyboardType="phone-pad" placeholder="09xx xxx xxx" />
        </View>
      </View>

      <Pressable onPress={() => setMore((value) => !value)} style={styles.moreToggle} hitSlop={6}>
        <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={16} color={palette.primary} />
        <Text style={[styles.change, { color: palette.primary }]}>{more ? 'Menos datos' : 'Más datos (email, otro contacto, ciudad)'}</Text>
      </Pressable>
      {more && (
        <>
          <Input label="Email" value={form.email ?? ''} onChangeText={(v) => set('email', v)} colors={colors} keyboardType="email-address" autoCapitalize="none" />
          {/* El celular del cliente suele ser el que deja en el taller: un contacto alternativo evita no poder avisarle. */}
          <View style={styles.pair}>
            <View style={styles.flex}>
              <Input label="Otro contacto" value={form.alternatePhone ?? ''} onChangeText={(v) => set('alternatePhone', v)} colors={colors} keyboardType="phone-pad" />
            </View>
            <View style={styles.flex}>
              <Input label="¿De quién?" value={form.alternatePhoneLabel ?? ''} onChangeText={(v) => set('alternatePhoneLabel', v)} colors={colors} placeholder="Esposa, trabajo…" />
            </View>
          </View>
          <Input label="Ciudad" value={form.city ?? ''} onChangeText={(v) => set('city', v)} colors={colors} autoCapitalize="words" />
        </>
      )}
      {!more && <Text style={[styles.caption, { color: colors.muted }]}>Si el equipo es su celular, sumá «Otro contacto» para poder avisarle.</Text>}

      {error && <Text style={styles.error}>{error}</Text>}
      {duplicates.map((duplicate) => (
        <View key={`${duplicate.customerId}-${duplicate.field}`} style={[styles.duplicate, { borderColor: '#D9770666', backgroundColor: '#D9770612' }]}>
          <Ionicons name="alert-circle-outline" size={18} color="#D97706" />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]}>{duplicate.customerName}</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              Ya tiene ese {FIELD_LABEL[duplicate.field] ?? duplicate.field}: {duplicate.value}
            </Text>
          </View>
          <Pressable onPress={() => pickExisting(duplicate)} style={[styles.useBtn, { backgroundColor: palette.primary }]}>
            {usingId === duplicate.customerId ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.useText}>Usar este</Text>}
          </Pressable>
        </View>
      ))}

      <View style={styles.pair}>
        <Pressable onPress={onCancel} style={[styles.btn, styles.flex, { borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.btnText, { color: colors.text }]}>Volver a buscar</Text>
        </Pressable>
        <Pressable onPress={save} disabled={saving} style={[styles.btn, styles.flex, { backgroundColor: palette.primary, opacity: problem || saving ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: '#fff' }]}>Crear cliente</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function Info({ icon, text, colors, muted }: { icon: keyof typeof Ionicons.glyphMap; text: string; colors: Colors; muted?: boolean }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={13} color={colors.muted} />
      <Text style={[styles.detail, { color: muted ? colors.muted : colors.text }]}>{text}</Text>
    </View>
  );
}

function Toggle({ label, icon, selected, onPress, colors }: { label: string; icon: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.toggle, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.1)' : colors.background }]}>
      <Ionicons name={icon} size={15} color={selected ? palette.primary : colors.muted} />
      <Text style={[styles.toggleText, { color: selected ? palette.primary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Input({ label, colors, ...props }: React.ComponentProps<typeof TextInput> & { label: string; colors: Colors }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: 8 },
  pair: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  caption: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarLg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 15, fontWeight: '800' },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '800' },
  detail: { fontSize: 12, marginTop: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  selected: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  change: { fontSize: 13, fontWeight: '800' },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, minHeight: 46 },
  newText: { fontSize: 14, fontWeight: '800' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  toggleText: { fontSize: 13, fontWeight: '700' },
  field: { gap: 5 },
  label: { fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  moreToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  duplicate: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  useBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 82, alignItems: 'center' },
  useText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  btn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 46 },
  btnText: { fontSize: 14, fontWeight: '800' },
});
