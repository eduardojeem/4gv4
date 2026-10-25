import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { collectPayment, dateOnly, fetchCustomerDebts, type CollectResult, type Debt, type DebtSummary } from '@/lib/customers';
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import { secureStorage } from '@/lib/secure-storage';
import { getPendingMobileCollection, MobileCollectionAttemptError, retryMobileCollection, submitMobileCollection, type CollectionAttemptContext, type PendingMobileCollection } from '@/lib/credit-collection-attempt';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

type Colors = ReturnType<typeof usePalette>;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

const METHODS = [
  { key: 'cash', label: 'Efectivo', icon: 'cash-outline' },
  { key: 'card', label: 'Tarjeta', icon: 'card-outline' },
  { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline' },
] as const;

/**
 * Cobro de deudas de un cliente, como «Cobrar» de la ficha web: cuotas y
 * reparaciones pendientes. Por defecto se aplica de la más vieja a la más
 * nueva; se puede elegir qué cobrar. Si sobra, va a saldo a favor solo si se
 * confirma. Genera el mismo comprobante que la web.
 */
export function CollectSheet({
  customerId,
  customerName,
  focusDebtId,
  onClose,
  onDone,
}: {
  customerId: string;
  customerName: string;
  /** Abre con esa cuota elegida (por ejemplo, desde la cartera de créditos). */
  focusDebtId?: string;
  onClose: () => void;
  onDone: (result: CollectResult) => void;
}) {
  const colors = usePalette();
  const [data, setData] = useState<DebtSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(focusDebtId ? new Set([focusDebtId]) : null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [reference, setReference] = useState('');
  const [voucher, setVoucher] = useState('');
  const [last4, setLast4] = useState('');
  const [excess, setExcess] = useState(false);
  const [attemptContext, setAttemptContext] = useState<CollectionAttemptContext | null>(null);
  const [pendingAttempt, setPendingAttempt] = useState<PendingMobileCollection | null>(null);
  const [pendingBlocked, setPendingBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CollectResult | null>(null);

  useEffect(() => {
    let active = true;
    fetchCustomerDebts(customerId)
      .then((summary) => {
        if (!active) return;
        const cacheContext = getPrivateCacheContext();
        if (!cacheContext.userId || !cacheContext.organizationId) throw new Error('Esperá a que se confirme tu usuario y organización antes de cobrar.');
        const scopedContext: CollectionAttemptContext = {
          userId: cacheContext.userId,
          organizationId: cacheContext.organizationId,
          branchId: summary.branchId ?? cacheContext.branchId,
          customerId,
        };
        setData(summary);
        setAttemptContext(scopedContext);
        setPendingBlocked(false);
        const target = focusDebtId ? summary.debts.filter((debt) => debt.id === focusDebtId) : summary.debts.filter((debt) => debt.collectable);
        setAmount(pretty(target.reduce((sum, debt) => sum + debt.pendingAmount, 0)));
        return getPendingMobileCollection(secureStorage, scopedContext).then((pending) => { if (active) setPendingAttempt(pending); });
      })
      .catch((err) => {
        if (!active) return;
        setData(null);
        setPendingBlocked(err instanceof MobileCollectionAttemptError && err.uncertain);
        setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las deudas.');
      });
    return () => { active = false; };
  }, [customerId, focusDebtId]);

  useEffect(() => subscribePrivateCacheContext((next, previous) => {
    if (next.userId === previous.userId && next.organizationId === previous.organizationId && next.branchId === previous.branchId) return;
    setData(null);
    setAttemptContext(null);
    setPendingAttempt(null);
    setPendingBlocked(false);
    setError('Cambió el usuario, la organización o la sucursal. Abrí el cobro de nuevo para validar el contexto.');
    onClose();
  }), [onClose]);

  const collectable = (data?.debts ?? []).filter((debt) => debt.collectable && debt.pendingAmount > 0);
  const chosen = selected ? collectable.filter((debt) => selected.has(debt.id)) : collectable;
  const chosenTotal = chosen.reduce((sum, debt) => sum + debt.pendingAmount, 0);
  const value = digits(amount);
  const overflow = Math.max(0, value - chosenTotal);

  const toggle = (debt: Debt) => {
    const next = new Set(selected ?? collectable.map((row) => row.id));
    if (next.has(debt.id)) next.delete(debt.id);
    else next.add(debt.id);
    setSelected(next);
    const total = collectable.filter((row) => next.has(row.id)).reduce((sum, row) => sum + row.pendingAmount, 0);
    setAmount(pretty(total));
  };

  const problem =
    value <= 0
      ? 'Escribí el monto.'
      : chosen.length === 0
        ? 'Elegí qué cobrar.'
        : overflow > 0 && !excess
          ? `Sobran ${formatGs(overflow)}: confirmá pasarlo a saldo a favor o bajá el monto.`
          : method === 'transfer' && !reference.trim()
            ? 'Anotá el comprobante de la transferencia.'
            : method === 'card' && !voucher.trim()
              ? 'Anotá el número de cupón del POS.'
              : null;

  const save = async () => {
    if (!pendingAttempt && problem) return setError(problem);
    if (pendingBlocked) return setError('Resolvé el intento pendiente desde la sucursal original antes de cobrar de nuevo.');
    if (!attemptContext) return setError('Esperá a que se confirme tu usuario, organización y sucursal.');
    const current = getPrivateCacheContext();
    if (current.userId !== attemptContext.userId || current.organizationId !== attemptContext.organizationId || (current.branchId && current.branchId !== attemptContext.branchId)) {
      return setError('Cambió el contexto del cobro. Cerrá esta ventana y volvé a abrirla para continuar.');
    }
    setSaving(true);
    setError(null);
    try {
      // Con todo elegido va en automático (más vieja primero); con selección, a lo elegido en orden.
      let remaining = Math.min(value, chosenTotal);
      const allocations = selected
        ? chosen
            .map((debt) => {
              const applied = Math.min(remaining, debt.pendingAmount);
              remaining -= applied;
              return { id: debt.id, type: debt.type === 'repair' ? ('repair' as const) : ('installment' as const), amount: applied };
            })
            .filter((row) => row.amount > 0)
        : undefined;
      const payload = {
          amount: value,
          method,
          allocations,
          referenceNumber: reference,
          voucherNumber: voucher,
          lastFourDigits: last4,
          excessToStoreCredit: overflow > 0 && excess,
          branchId: data?.branchId,
        };
      const response = pendingAttempt
        ? await retryMobileCollection(secureStorage, attemptContext, { storage: secureStorage, collect: collectPayment })
        : await submitMobileCollection(attemptContext, payload, { storage: secureStorage, collect: collectPayment });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPendingAttempt(null);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cobrar.');
      if (attemptContext) {
        try {
          setPendingAttempt(await getPendingMobileCollection(secureStorage, attemptContext));
          setPendingBlocked(false);
        } catch (pendingError) {
          setPendingBlocked(pendingError instanceof MobileCollectionAttemptError && pendingError.uncertain);
        }
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const text = [
      `Comprobante de pago N.º ${result.receiptNumber}`,
      `Cliente: ${customerName}`,
      ...result.appliedAllocations.map((row) => `${row.title}: ${formatGs(row.allocatedAmount)}${row.fullyPaid ? ' (saldada)' : ` · queda ${formatGs(row.newPending)}`}`),
      `Total cobrado: ${formatGs(result.totalApplied + result.excessToStoreCredit)}`,
      result.excessToStoreCredit > 0 ? `A saldo a favor: ${formatGs(result.excessToStoreCredit)}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    return (
      <BottomSheet
        visible
        title="Cobro registrado"
        onClose={() => onDone(result)}
        footer={
          <View style={styles.footer}>
            <Pressable onPress={() => Share.share({ message: text })} style={[styles.ghost, { borderColor: colors.border }]}>
              <Ionicons name="share-outline" size={18} color={colors.text} />
              <Text style={[styles.bold, { color: colors.text }]}>Enviar</Text>
            </Pressable>
            <Pressable onPress={() => onDone(result)} style={[styles.solid, { backgroundColor: palette.primary }]}>
              <Text style={styles.solidText}>Listo</Text>
            </Pressable>
          </View>
        }>
        <View style={styles.doneHead}>
          <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
          <Text style={[styles.doneTotal, { color: colors.text }]}>{formatGs(result.totalApplied + result.excessToStoreCredit)}</Text>
          <Text style={[styles.small, { color: colors.muted }]}>Comprobante N.º {result.receiptNumber}</Text>
        </View>
        {result.appliedAllocations.map((row) => (
          <View key={row.id} style={[styles.debt, { borderColor: colors.border }]}>
            <Ionicons name={row.fullyPaid ? 'checkmark-done' : 'remove-circle-outline'} size={18} color={row.fullyPaid ? '#16A34A' : '#D97706'} />
            <Text style={[styles.bold, styles.flex, { color: colors.text }]}>{row.title}</Text>
            <View style={styles.alignEnd}>
              <Text style={[styles.bold, { color: colors.text }]}>{formatGs(row.allocatedAmount)}</Text>
              <Text style={[styles.small, { color: row.fullyPaid ? '#16A34A' : colors.muted }]}>{row.fullyPaid ? 'Saldada' : `Queda ${formatGs(row.newPending)}`}</Text>
            </View>
          </View>
        ))}
        {result.excessToStoreCredit > 0 && <Text style={[styles.small, { color: '#2563EB' }]}>{formatGs(result.excessToStoreCredit)} quedaron como saldo a favor.</Text>}
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      visible
      tall
      title={`Cobrar a ${customerName}`}
      subtitle={data ? `Deuda total ${formatGs(data.totalDebt)}${data.overdueDebt > 0 ? ` · vencido ${formatGs(data.overdueDebt)}` : ''}` : undefined}
      onClose={() => !saving && onClose()}
      footer={
        pendingBlocked ? (
          <View style={styles.footerCol}>
            <Text accessibilityRole="alert" style={[styles.small, styles.center, { color: palette.danger }]}>{error ?? 'Existe un intento pendiente en otro contexto; no se puede iniciar otro cobro.'}</Text>
          </View>
        ) : pendingAttempt && attemptContext ? (
          <View style={styles.footerCol}>
            <Text style={[styles.small, styles.center, { color: colors.muted }]}>Hay un cobro cuyo resultado no se confirmó. Recuperá el mismo intento antes de iniciar otro.</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={save} disabled={saving} style={[styles.solid, { backgroundColor: '#D97706', opacity: saving ? 0.55 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.solidText}>Recuperar cobro pendiente</Text>}
            </Pressable>
          </View>
        ) : data && collectable.length > 0 ? (
          <View style={styles.footerCol}>
            {problem ? <Text style={[styles.small, styles.center, { color: colors.muted }]}>{problem}</Text> : null}
            <Pressable onPress={save} disabled={saving} style={[styles.solid, { backgroundColor: '#16A34A', opacity: saving || problem ? 0.55 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.solidText}>Cobrar {formatGs(value)}</Text>}
            </Pressable>
          </View>
        ) : null
      }>
      {!data && !loadError && <ActivityIndicator color={palette.primary} />}
      {loadError && <Text style={styles.error}>{loadError}</Text>}
      {(pendingAttempt || pendingBlocked) && (
        <View style={styles.doneHead}>
          <Ionicons name="time-outline" size={42} color="#D97706" />
          <Text style={[styles.bold, { color: colors.text }]}>{pendingBlocked ? 'Cobro pendiente en otro contexto' : 'Cobro pendiente de confirmar'}</Text>
          <Text style={[styles.small, { color: colors.muted }]}>{pendingBlocked ? 'Volvé a la sucursal original para recuperar el resultado. No se enviará un cobro nuevo desde esta sucursal.' : `Monto: ${formatGs(pendingAttempt!.input.amount)}. Se recuperará con la misma clave de seguridad.`}</Text>
        </View>
      )}
      {data && !pendingAttempt && !pendingBlocked && collectable.length === 0 && (
        <View style={styles.doneHead}>
          <Ionicons name="happy-outline" size={44} color="#16A34A" />
          <Text style={[styles.bold, { color: colors.text }]}>No tiene deudas para cobrar.</Text>
        </View>
      )}

      {collectable.length > 0 && !pendingAttempt && !pendingBlocked && (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Qué cobra ({chosen.length} de {collectable.length})</Text>
          {collectable.map((debt) => {
            const checked = !selected || selected.has(debt.id);
            return (
              <Pressable key={debt.id} onPress={() => toggle(debt)} style={[styles.debt, { borderColor: colors.border }]}>
                <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? palette.primary : colors.muted} />
                <View style={styles.flex}>
                  <Text style={[styles.bold, { color: colors.text }]}>{debt.title}</Text>
                  <Text style={[styles.small, { color: debt.isOverdue ? palette.danger : colors.muted }]}>
                    {[debt.subtitle, debt.dueDate ? `vence ${dateOnly(debt.dueDate)}` : null, debt.isOverdue ? 'vencida' : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={[styles.bold, { color: colors.text }]}>{formatGs(debt.pendingAmount)}</Text>
              </Pressable>
            );
          })}

          <View style={[styles.moneyWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.bold, { color: colors.muted }]}>Gs.</Text>
            <TextInput value={amount} onChangeText={(next) => setAmount(pretty(next))} keyboardType="number-pad" style={[styles.moneyInput, { color: colors.text }]} accessibilityLabel="Monto a cobrar" />
            {value !== chosenTotal && (
              <Pressable onPress={() => setAmount(pretty(chosenTotal))} hitSlop={8}>
                <Text style={[styles.link, { color: palette.primary }]}>Todo</Text>
              </Pressable>
            )}
          </View>
          {value > 0 && value < chosenTotal && <Text style={[styles.small, { color: colors.muted }]}>Pago parcial: se aplica a lo más viejo primero; queda {formatGs(chosenTotal - value)}.</Text>}
          {overflow > 0 && (
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={[styles.bold, { color: colors.text }]}>Pasar {formatGs(overflow)} a saldo a favor</Text>
                <Text style={[styles.small, { color: colors.muted }]}>Lo puede usar en próximas compras</Text>
              </View>
              <Switch value={excess} onValueChange={setExcess} trackColor={{ true: palette.primary }} />
            </View>
          )}

          <View style={styles.methods}>
            {METHODS.map((item) => (
              <Pressable key={item.key} onPress={() => setMethod(item.key)} style={[styles.method, { borderColor: method === item.key ? palette.primary : colors.border, backgroundColor: method === item.key ? 'rgba(37,99,235,0.08)' : colors.background }]}>
                <Ionicons name={item.icon} size={20} color={method === item.key ? palette.primary : colors.muted} />
                <Text style={[styles.small, styles.bold, { color: method === item.key ? palette.primary : colors.text }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {method === 'transfer' && <Field placeholder="N.º de comprobante" value={reference} onChange={setReference} colors={colors} />}
          {method === 'card' && (
            <View style={styles.pair}>
              <View style={styles.flex}>
                <Field placeholder="N.º de cupón" value={voucher} onChange={setVoucher} colors={colors} />
              </View>
              <View style={styles.flex}>
                <Field placeholder="Últimos 4" value={last4} onChange={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))} colors={colors} numeric />
              </View>
            </View>
          )}
          {data?.storeBalance ? <Text style={[styles.small, { color: '#2563EB' }]}>Tiene {formatGs(data.storeBalance)} de saldo a favor (se usa desde la web).</Text> : null}
          {error && <Text style={styles.error}>{error}</Text>}
        </>
      )}
    </BottomSheet>
  );
}

function Field({ placeholder, value, onChange, colors, numeric }: { placeholder: string; value: string; onChange: (value: string) => void; colors: Colors; numeric?: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={numeric ? 'number-pad' : 'default'}
      autoCapitalize="characters"
      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  bold: { fontSize: 14, fontWeight: '800' },
  small: { fontSize: 12 },
  center: { textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '800' },
  link: { fontSize: 13, fontWeight: '800' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 10 },
  footerCol: { gap: 6 },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' },
  solid: { flex: 1, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  doneHead: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  doneTotal: { fontSize: 30, fontWeight: '900' },
  debt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  moneyWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  moneyInput: { flex: 1, fontSize: 22, fontWeight: '900', paddingVertical: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10 },
  pair: { flexDirection: 'row', gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
});
