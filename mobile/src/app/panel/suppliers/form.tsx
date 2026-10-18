import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import { createSupplier, fetchSupplier, isActiveSupplier, updateSupplier, type SupplierInput } from '@/lib/suppliers';

type Colors = ReturnType<typeof usePalette>;
type TextKey = Exclude<keyof SupplierInput, 'is_active' | 'credit_limit' | 'current_debt' | 'rating'>;

const TERMS = ['Contado', '15 días', '30 días', '60 días', 'Consignación'];
const money = (value: string) => {
  const only = value.replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};
const toNumber = (value: string) => (value.replace(/\D/g, '') ? Number(value.replace(/\D/g, '')) : null);

/** Alta y edición de proveedores, con los mismos campos que la web. */
export default function SupplierForm() {
  const colors = usePalette();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const editing = params.id || null;
  const [form, setForm] = useState<SupplierInput>({ name: params.name ?? '', is_active: true });
  const [limit, setLimit] = useState('');
  const [debt, setDebt] = useState('');
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(Boolean(editing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    fetchSupplier(editing)
      .then((supplier) => {
        setForm({
          name: supplier.name,
          contact_name: supplier.contact_name ?? '',
          phone: supplier.phone ?? '',
          email: supplier.email ?? '',
          tax_id: supplier.tax_id ?? '',
          address: supplier.address ?? '',
          city: supplier.city ?? '',
          category: supplier.category ?? '',
          payment_terms: supplier.payment_terms ?? '',
          website: supplier.website ?? '',
          notes: supplier.notes ?? '',
          is_active: isActiveSupplier(supplier),
        });
        setLimit(supplier.credit_limit ? money(String(supplier.credit_limit)) : '');
        setDebt(supplier.current_debt ? money(String(supplier.current_debt)) : '');
        setRating(Math.round(Number(supplier.rating) || 0));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el proveedor.'))
      .finally(() => setLoading(false));
  }, [editing]);

  const set = (key: TextKey, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const emailInvalid = Boolean(form.email?.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email!.trim());
  const problem = form.name.trim().length < 2 ? 'Escribí el nombre (al menos 2 letras).' : emailInvalid ? 'Revisá el email.' : null;

  const save = async () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    const input: SupplierInput = { ...form, credit_limit: toNumber(limit), current_debt: toNumber(debt), rating: rating || null };
    try {
      if (editing) await updateSupplier(editing, input);
      else await createSupplier(input);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (router.canGoBack()) router.back();
      else router.replace('/panel/suppliers' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/panel/suppliers' as never))} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={palette.primary} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Section title="Datos" colors={colors}>
              <Input label="Nombre o razón social" value={form.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" autoFocus={!editing && !form.name} colors={colors} />
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Input label="RUC" value={form.tax_id ?? ''} onChangeText={(v) => set('tax_id', v)} keyboardType="numbers-and-punctuation" colors={colors} />
                </View>
                <View style={styles.flex}>
                  <Input label="Rubro" value={form.category ?? ''} onChangeText={(v) => set('category', v)} placeholder="Repuestos, bebidas…" colors={colors} />
                </View>
              </View>
            </Section>

            <Section title="Contacto" colors={colors}>
              <Input label="Persona de contacto" value={form.contact_name ?? ''} onChangeText={(v) => set('contact_name', v)} autoCapitalize="words" colors={colors} />
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Input label="Teléfono" value={form.phone ?? ''} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" colors={colors} />
                </View>
                <View style={styles.flex}>
                  <Input label="Email" value={form.email ?? ''} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" colors={colors} />
                </View>
              </View>
              <Input label="Dirección" value={form.address ?? ''} onChangeText={(v) => set('address', v)} colors={colors} />
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Input label="Ciudad" value={form.city ?? ''} onChangeText={(v) => set('city', v)} autoCapitalize="words" colors={colors} />
                </View>
                <View style={styles.flex}>
                  <Input label="Sitio web" value={form.website ?? ''} onChangeText={(v) => set('website', v)} keyboardType="url" autoCapitalize="none" colors={colors} />
                </View>
              </View>
            </Section>

            <Section title="Condiciones" colors={colors}>
              <Text style={[styles.label, { color: colors.text }]}>Condición de pago</Text>
              <View style={styles.chips}>
                {TERMS.map((term) => {
                  const selected = form.payment_terms === term;
                  return (
                    <Pressable key={term} onPress={() => set('payment_terms', selected ? '' : term)} style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.background }]}>
                      <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }]}>{term}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Input label="Límite de crédito (Gs.)" value={limit} onChangeText={(v) => setLimit(money(v))} keyboardType="number-pad" placeholder="0" colors={colors} />
                </View>
                <View style={styles.flex}>
                  <Input label="Deuda actual (Gs.)" value={debt} onChangeText={(v) => setDebt(money(v))} keyboardType="number-pad" placeholder="0" colors={colors} />
                </View>
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Calificación</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable key={value} onPress={() => setRating(rating === value ? 0 : value)} hitSlop={6} accessibilityLabel={`${value} estrellas`}>
                    <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={28} color={value <= rating ? '#F59E0B' : colors.muted} />
                  </Pressable>
                ))}
              </View>
            </Section>

            <Section title="Notas" colors={colors}>
              <TextInput value={form.notes ?? ''} onChangeText={(v) => set('notes', v)} multiline maxLength={2000} placeholder="Días de visita, descuentos, observaciones…" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text style={[styles.label, { color: colors.text }]}>Proveedor activo</Text>
                  <Text style={[styles.tiny, { color: colors.muted }]}>Los inactivos no aparecen para asignar a productos.</Text>
                </View>
                <Switch value={form.is_active} onValueChange={(value) => setForm((current) => ({ ...current, is_active: value }))} />
              </View>
            </Section>

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>
          <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable onPress={save} disabled={saving} style={[styles.submit, { opacity: saving || problem ? 0.6 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
              <Text style={styles.submitText}>{editing ? 'Guardar cambios' : 'Crear proveedor'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Section({ title, colors, children }: { title: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
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
  tiny: { fontSize: 11 },
  loading: { paddingVertical: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  pair: { flexDirection: 'row', gap: 10 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 54 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
