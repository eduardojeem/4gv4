import { PanelAccessState } from '@/components/panel-access-state';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createCustomer, DuplicateError, fetchCustomer, updateCustomer, type CustomerInput, type Duplicate } from '@/lib/customers';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;
const FIELD: Record<string, string> = { phone: 'teléfono', email: 'email', ruc: 'CI/RUC' };

const TYPES: { key: NonNullable<CustomerInput['customer_type']>; label: string; icon: keyof typeof Ionicons.glyphMap; help: string }[] = [
  { key: 'regular', label: 'Persona', icon: 'person-outline', help: 'Precio minorista' },
  { key: 'wholesale', label: 'Mayorista', icon: 'briefcase-outline', help: 'Precio mayorista en el POS' },
  { key: 'empresa', label: 'Empresa', icon: 'business-outline', help: 'Razón social y RUC' },
];

/** Alta y edición de clientes, con los mismos controles de duplicados que la web. */
export default function CustomerForm() {
  const colors = usePalette();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const editing = params.id || null;
  const [form, setForm] = useState<CustomerInput>({ name: params.name ?? '', customer_type: 'regular' });
  const [loading, setLoading] = useState(Boolean(editing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const { findItem, can } = usePanel();
  const creditsEnabled = Boolean(findItem('credits'));
  // El límite se manda solo si se tocó (con la ficha para crédito obligatoria el servidor no deja cambiarlo acá).
  const [limit, setLimit] = useState('');
  const [originalLimit, setOriginalLimit] = useState(0);

  useEffect(() => {
    if (!editing) return;
    fetchCustomer(editing)
      .then((customer) => {
        const current = Math.max(0, Number(customer.credit_limit) || 0);
        setOriginalLimit(current);
        setLimit(current ? current.toLocaleString('es-PY') : '');
        setForm({
          name: customer.name,
          phone: customer.phone ?? '',
          alternate_phone: customer.alternate_phone ?? '',
          alternate_phone_label: customer.alternate_phone_label ?? '',
          email: customer.email ?? '',
          ruc: customer.ruc ?? '',
          address: customer.address ?? '',
          city: customer.city ?? '',
          customer_type: (['wholesale', 'empresa'].includes(String(customer.customer_type)) ? customer.customer_type : 'regular') as CustomerInput['customer_type'],
          notes: customer.notes ?? '',
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el cliente.'))
      .finally(() => setLoading(false));
  }, [editing]);

  const set = (key: keyof CustomerInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDuplicates([]);
  };

  const company = form.customer_type === 'empresa';
  const emailInvalid = Boolean(form.email?.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email!.trim());
  const problem = !form.name.trim() ? 'Escribí el nombre.' : emailInvalid ? 'Revisá el email.' : null;

  const save = async () => {
    if (!(can('crm.customers.manage') || (!editing && can('pos.sales.create')))) return;
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    setDuplicates([]);
    try {
      const limitValue = Number(limit.replace(/\D/g, '')) || 0;
      const input = creditsEnabled && limitValue !== originalLimit ? { ...form, credit_limit: limitValue } : form;
      const saved = editing ? await updateCustomer(editing, input) : await createCustomer(input);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (editing) router.back();
      else router.replace(`/panel/customers/${saved.id}` as never);
    } catch (err) {
      if (err instanceof DuplicateError) setDuplicates(err.duplicates);
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setSaving(false);
    }
  };

  if (!(can('crm.customers.manage') || (!editing && can('pos.sales.create')))) return <PanelAccessState />;

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/panel/customers' as never))} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>{editing ? 'Editar cliente' : 'Nuevo cliente'}</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={palette.primary} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.types}>
              {TYPES.map((type) => {
                const selected = form.customer_type === type.key;
                return (
                  <Pressable key={type.key} onPress={() => setForm((current) => ({ ...current, customer_type: type.key }))} style={[styles.type, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.card }]}>
                    <Ionicons name={type.icon} size={20} color={selected ? palette.primary : colors.muted} />
                    <Text style={[styles.typeLabel, { color: selected ? palette.primary : colors.text }]}>{type.label}</Text>
                    <Text style={[styles.tiny, { color: colors.muted }]}>{type.help}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Section title="Datos" colors={colors}>
              <Input label={company ? 'Razón social' : 'Nombre y apellido'} value={form.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" autoFocus={!editing && !form.name} colors={colors} />
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Input label={company ? 'RUC' : 'CI / RUC'} value={form.ruc ?? ''} onChangeText={(v) => set('ruc', v)} keyboardType="numbers-and-punctuation" colors={colors} />
                </View>
                <View style={styles.flex}>
                  <Input label="Teléfono" value={form.phone ?? ''} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" placeholder="09xx xxx xxx" colors={colors} />
                </View>
              </View>
              <Input label="Email" value={form.email ?? ''} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" colors={colors} />
            </Section>

            <Section title="Otro contacto" colors={colors} hint="Si el teléfono del cliente queda en el taller, a quién avisar.">
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Input label="Teléfono" value={form.alternate_phone ?? ''} onChangeText={(v) => set('alternate_phone', v)} keyboardType="phone-pad" colors={colors} />
                </View>
                <View style={styles.flex}>
                  <Input label="¿De quién?" value={form.alternate_phone_label ?? ''} onChangeText={(v) => set('alternate_phone_label', v)} placeholder="Esposa, trabajo…" colors={colors} />
                </View>
              </View>
            </Section>

            <Section title="Dirección" colors={colors}>
              <Input label="Dirección" value={form.address ?? ''} onChangeText={(v) => set('address', v)} colors={colors} />
              <Input label="Ciudad" value={form.city ?? ''} onChangeText={(v) => set('city', v)} autoCapitalize="words" colors={colors} />
            </Section>

            {creditsEnabled && (
              <Section title="Crédito" colors={colors} hint="Hasta cuánto puede deber en cuotas. En 0 no se le puede vender a crédito.">
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Límite de crédito</Text>
                  <View style={[styles.money, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
                    <TextInput
                      value={limit}
                      onChangeText={(value) => {
                        const only = value.replace(/\D/g, '');
                        setLimit(only ? Number(only).toLocaleString('es-PY') : '');
                      }}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      accessibilityLabel="Límite de crédito"
                      style={[styles.moneyInput, { color: colors.text }]}
                    />
                  </View>
                  {editing && originalLimit > 0 ? <Text style={[styles.tiny, { color: colors.muted }]}>Actual: {formatGs(originalLimit)}</Text> : null}
                </View>
              </Section>
            )}

            <Section title="Notas" colors={colors}>
              <TextInput value={form.notes ?? ''} onChangeText={(v) => set('notes', v)} multiline maxLength={2000} placeholder="Preferencias, horarios, observaciones…" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
            </Section>

            {error && <Text style={styles.error}>{error}</Text>}
            {duplicates.map((duplicate) => (
              <Pressable key={`${duplicate.customerId}-${duplicate.field}`} onPress={() => router.replace(`/panel/customers/${duplicate.customerId}` as never)} style={[styles.duplicate, { borderColor: '#D9770666', backgroundColor: '#D9770612' }]}>
                <View style={styles.flex}>
                  <Text style={[styles.bold, { color: colors.text }]}>{duplicate.customerName}</Text>
                  <Text style={[styles.tiny, { color: colors.muted }]}>Ya tiene ese {FIELD[duplicate.field] ?? duplicate.field}: {duplicate.value}</Text>
                </View>
                <Text style={[styles.bold, { color: palette.primary }]}>Ver ficha ›</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable onPress={save} disabled={saving} style={[styles.submit, { opacity: saving || problem ? 0.6 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
              <Text style={styles.submitText}>{editing ? 'Guardar cambios' : 'Crear cliente'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Section({ title, hint, colors, children }: { title: string; hint?: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.tiny, { color: colors.muted }]}>{hint}</Text> : null}
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
  bold: { fontSize: 14, fontWeight: '800' },
  tiny: { fontSize: 11 },
  loading: { paddingVertical: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  types: { flexDirection: 'row', gap: 8 },
  type: { flex: 1, alignItems: 'center', gap: 3, borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4 },
  typeLabel: { fontSize: 13, fontWeight: '800' },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  pair: { flexDirection: 'row', gap: 10 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  money: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontSize: 15, fontWeight: '700' },
  moneyInput: { flex: 1, fontSize: 17, fontWeight: '800', paddingVertical: 11 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  duplicate: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 54 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
