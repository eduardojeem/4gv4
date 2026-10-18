import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import {
  customerName,
  deliverRepair,
  deliveryOutcomeFor,
  deviceName,
  money,
  newIdempotencyKey,
  PAY_METHODS,
  ticketOf,
  type PayMethod,
  type Repair,
  type UnrepairedDelivery,
} from '@/lib/repairs';

type Colors = ReturnType<typeof usePalette>;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string) => {
  const only = value.replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

/**
 * Entrega del equipo, con las mismas reglas que la web:
 * - Reparado: se cobra el saldo (efectivo, tarjeta o transferencia) o se
 *   entrega con saldo pendiente, confirmándolo a propósito.
 * - Sin reparar: cargo opcional por la revisión y qué hacer con lo ya pagado.
 * El servidor valida la verificación técnica y que haya caja abierta para cobrar.
 */
export function DeliverySheet({
  repair,
  visible,
  onClose,
  onDelivered,
}: {
  repair: Repair;
  visible: boolean;
  onClose: () => void;
  onDelivered: (repair: Repair) => void;
}) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const outcome = deliveryOutcomeFor(repair);
  const { total, paid, balance } = money(repair);

  const [key, setKey] = useState(newIdempotencyKey);
  const [collect, setCollect] = useState(true);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [amount, setAmount] = useState(() => (balance > 0 ? balance.toLocaleString('es-PY') : ''));
  const [reference, setReference] = useState('');
  const [confirmOutstanding, setConfirmOutstanding] = useState(false);
  const [charge, setCharge] = useState('');
  const [refund, setRefund] = useState<'store_credit' | 'refund'>('store_credit');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKey(newIdempotencyKey());
    setCollect(true);
    setMethod('cash');
    setAmount(balance > 0 ? balance.toLocaleString('es-PY') : '');
    setReference('');
    setConfirmOutstanding(false);
    setCharge('');
    setRefund('store_credit');
    setNote('');
    setError(null);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  // ── Reparado ──
  const payAmount = collect ? Math.min(digits(amount), balance) : 0;
  const remaining = Math.max(0, balance - payAmount);
  const needsReference = method === 'card' || method === 'transfer';

  // ── Sin reparar ──
  const chargeAmount = digits(charge);
  const difference = chargeAmount - paid; // > 0 falta cobrar; < 0 sobra lo pagado

  const problem = (() => {
    if (!outcome) return 'Primero hacé la verificación técnica.';
    if (outcome === 'repaired') {
      if (balance > 0 && collect && payAmount <= 0) return 'Escribí cuánto cobrás.';
      if (balance > 0 && collect && needsReference && !reference.trim()) return 'Anotá la referencia del comprobante.';
      if (remaining > 0 && !confirmOutstanding) return `Confirmá que se entrega con ${formatGs(remaining)} pendiente.`;
      return null;
    }
    if (difference > 0 && collect && method === 'transfer' && !reference.trim()) return 'Anotá la referencia de la transferencia.';
    return null;
  })();

  const submitLabel = (() => {
    if (outcome === 'repaired') return payAmount > 0 ? `Cobrar ${formatGs(payAmount)} y entregar` : 'Entregar equipo';
    if (difference > 0) return collect ? `Cobrar ${formatGs(difference)} y entregar` : 'Entregar con saldo pendiente';
    if (difference < 0) return refund === 'refund' ? 'Devolver y entregar' : 'Crear saldo a favor y entregar';
    return 'Entregar equipo';
  })();

  const submit = async () => {
    if (problem || !outcome || saving) {
      if (problem) setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let updated: Repair;
      if (outcome === 'repaired') {
        updated = await deliverRepair(
          repair.id,
          {
            outcome,
            note,
            allowOutstandingBalance: remaining > 0,
            payment: payAmount > 0 ? { method, amount: payAmount, reference } : undefined,
          },
          key
        );
      } else {
        const settlement: UnrepairedDelivery['settlement'] =
          difference > 0
            ? collect
              ? { kind: 'payment', method, amount: difference, reference }
              : { kind: 'outstanding' }
            : difference < 0
              ? refund === 'refund'
                ? { kind: 'refund', method: 'cash' }
                : { kind: 'store_credit' }
              : { kind: 'none' };
        updated = await deliverRepair(repair.id, { outcome, chargeAmount, settlement, note }, key);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDelivered(updated);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrega.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const renderMethods = () => (
    <View style={styles.chips}>
      {PAY_METHODS.map((item) => (
        <Choice key={item.key} label={item.label} icon={item.icon} selected={method === item.key} onPress={() => setMethod(item.key)} colors={colors} />
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar entrega" />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>Entregar equipo</Text>
              <Text style={[styles.small, { color: colors.muted }]}>
                {ticketOf(repair)} · {deviceName(repair)} · {customerName(repair)}
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Resultado (lo define la verificación técnica) */}
            <View
              style={[
                styles.banner,
                outcome === 'repaired'
                  ? { borderColor: '#16A34A55', backgroundColor: '#16A34A12' }
                  : { borderColor: '#D9770655', backgroundColor: '#D9770612' },
              ]}>
              <Ionicons name={outcome === 'repaired' ? 'checkmark-circle' : 'alert-circle'} size={18} color={outcome === 'repaired' ? '#16A34A' : '#D97706'} />
              <Text style={[styles.bannerText, { color: outcome === 'repaired' ? '#16A34A' : '#D97706' }]}>
                {outcome === 'repaired'
                  ? 'Reparado y funcionando'
                  : outcome === 'unrepairable'
                    ? 'No fue posible reparar'
                    : outcome === 'withdrawn'
                      ? 'Retiro sin reparar'
                      : 'Falta la verificación técnica'}
              </Text>
            </View>

            {outcome === 'repaired' && (
              <>
                <View style={[styles.totals, { borderColor: colors.border }]}>
                  <Total label="Total" value={formatGs(total)} colors={colors} />
                  <Total label="Pagado" value={formatGs(paid)} colors={colors} />
                  <Total label="Saldo" value={formatGs(balance)} colors={colors} tone={balance > 0 ? palette.danger : palette.success} />
                </View>

                {balance > 0 ? (
                  <>
                    <View style={styles.chips}>
                      <Choice label="Cobrar ahora" icon="cash-outline" selected={collect} onPress={() => setCollect(true)} colors={colors} />
                      <Choice label="Queda debiendo" icon="time-outline" selected={!collect} onPress={() => setCollect(false)} colors={colors} />
                    </View>
                    {collect && (
                      <View style={styles.block}>
                        {renderMethods()}
                        <Field label="Monto" colors={colors}>
                          <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
                          <TextInput
                            value={amount}
                            onChangeText={(value) => setAmount(pretty(value))}
                            keyboardType="number-pad"
                            accessibilityLabel="Monto a cobrar"
                            style={[styles.input, { color: colors.text }]}
                          />
                          {digits(amount) !== balance && (
                            <Pressable onPress={() => setAmount(balance.toLocaleString('es-PY'))} hitSlop={8}>
                              <Text style={[styles.link, { color: palette.primary }]}>Todo</Text>
                            </Pressable>
                          )}
                        </Field>
                        {digits(amount) > balance && <Text style={[styles.small, { color: colors.muted }]}>Se cobra como máximo el saldo: {formatGs(balance)}.</Text>}
                        {needsReference && (
                          <Field label={method === 'card' ? 'N.º de comprobante (voucher)' : 'Referencia de la transferencia'} colors={colors}>
                            <TextInput value={reference} onChangeText={setReference} autoCapitalize="characters" style={[styles.input, { color: colors.text }]} />
                          </Field>
                        )}
                      </View>
                    )}
                    {remaining > 0 && (
                      <Pressable
                        onPress={() => setConfirmOutstanding((value) => !value)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: confirmOutstanding }}
                        style={[styles.confirm, { borderColor: confirmOutstanding ? palette.danger : colors.border }]}>
                        <Ionicons name={confirmOutstanding ? 'checkbox' : 'square-outline'} size={22} color={confirmOutstanding ? palette.danger : colors.muted} />
                        <Text style={[styles.confirmText, { color: colors.text }]}>
                          Entrego igual: el cliente queda debiendo {formatGs(remaining)}.
                        </Text>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <Text style={[styles.small, { color: palette.success }]}>Está todo pagado.</Text>
                )}
              </>
            )}

            {(outcome === 'unrepairable' || outcome === 'withdrawn') && (
              <View style={styles.block}>
                <Field label="Cargo por la revisión (opcional)" colors={colors}>
                  <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
                  <TextInput
                    value={charge}
                    onChangeText={(value) => setCharge(pretty(value))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.text }]}
                  />
                </Field>
                <Text style={[styles.small, { color: colors.muted }]}>
                  Sin reparar no se cobra el presupuesto. Ya pagó {formatGs(paid)}.
                </Text>
                {difference > 0 && (
                  <>
                    <Text style={[styles.label, { color: colors.text }]}>Falta cobrar {formatGs(difference)}</Text>
                    <View style={styles.chips}>
                      <Choice label="Cobrar ahora" icon="cash-outline" selected={collect} onPress={() => setCollect(true)} colors={colors} />
                      <Choice label="Queda debiendo" icon="time-outline" selected={!collect} onPress={() => setCollect(false)} colors={colors} />
                    </View>
                    {collect && renderMethods()}
                    {collect && method === 'transfer' && (
                      <Field label="Referencia de la transferencia" colors={colors}>
                        <TextInput value={reference} onChangeText={setReference} autoCapitalize="characters" style={[styles.input, { color: colors.text }]} />
                      </Field>
                    )}
                  </>
                )}
                {difference < 0 && (
                  <>
                    <Text style={[styles.label, { color: colors.text }]}>Sobran {formatGs(-difference)} de lo pagado</Text>
                    <View style={styles.chips}>
                      <Choice label="Saldo a favor" icon="wallet-outline" selected={refund === 'store_credit'} onPress={() => setRefund('store_credit')} colors={colors} />
                      <Choice label="Devolver en efectivo" icon="cash-outline" selected={refund === 'refund'} onPress={() => setRefund('refund')} colors={colors} />
                    </View>
                  </>
                )}
              </View>
            )}

            {outcome && (
              <Field label="Nota de entrega (opcional)" colors={colors}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={2000}
                  placeholder="Quién retiró, observaciones…"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.multiline, { color: colors.text }]}
                />
              </Field>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <Pressable
            onPress={submit}
            disabled={!outcome || saving}
            style={[styles.submit, { opacity: !outcome || saving || problem ? 0.55 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="bag-check-outline" size={19} color="#fff" />}
            <Text style={styles.submitText}>{saving ? 'Registrando…' : submitLabel}</Text>
          </Pressable>
          {problem && outcome && <Text style={[styles.hint, { color: colors.muted }]}>{problem}</Text>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Choice({ label, icon, selected, onPress, colors }: { label: string; icon: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.1)' : colors.background }]}>
      <Ionicons name={icon} size={16} color={selected ? palette.primary : colors.muted} />
      <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, colors, children }: { label: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>{children}</View>
    </View>
  );
}

function Total({ label, value, colors, tone }: { label: string; value: string; colors: Colors; tone?: string }) {
  return (
    <View style={styles.flex}>
      <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.totalValue, { color: tone ?? colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.45)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '800' },
  small: { fontSize: 12, marginTop: 2 },
  body: { gap: 12, paddingBottom: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  bannerText: { fontSize: 14, fontWeight: '800' },
  totals: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  totalValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  block: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  chipText: { fontSize: 13, fontWeight: '700' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontSize: 15, fontWeight: '700' },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  link: { fontSize: 13, fontWeight: '800' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  confirmText: { flex: 1, fontSize: 14, fontWeight: '600' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, minHeight: 52, marginTop: 4, backgroundColor: '#475569' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 6 },
});
