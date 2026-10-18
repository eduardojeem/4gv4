import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PosCreditPanel } from '@/components/pos-credit-panel';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { isWholesaleCustomer, type PayMethod, type PaymentInput, type PosCustomer } from '@/lib/pos';
import { buildCreditPlan, DEFAULT_TERMS, fetchCreditStatus, firstPaymentError, minimumDownPayment, type CreditStatus, type CreditTerms } from '@/lib/pos-credit';

type Colors = ReturnType<typeof usePalette>;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

const METHODS: { key: PayMethod | 'mixed'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'cash', label: 'Efectivo', icon: 'cash-outline' },
  { key: 'card', label: 'Tarjeta', icon: 'card-outline' },
  { key: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline' },
  { key: 'mixed', label: 'Mixto', icon: 'git-merge-outline' },
  { key: 'credit', label: 'Crédito', icon: 'calendar-outline' },
];

/** Billetes de guaraníes para cobrar en efectivo con un toque. */
function quickBills(total: number) {
  const bills = [2000, 5000, 10000, 20000, 50000, 100000];
  const options = new Set<number>([total]);
  for (const bill of bills) {
    const rounded = Math.ceil(total / bill) * bill;
    if (rounded > total) options.add(rounded);
  }
  return [...options].sort((a, b) => a - b).slice(0, 5);
}

/**
 * Cobro de la venta, como «Cobrar venta» de la web: efectivo con vuelto,
 * tarjeta (últimos 4 dígitos), transferencia (referencia), mixto o a crédito
 * en cuotas (con entrega inicial opcional). Lo que se manda a la venta es
 * exactamente el total: el vuelto se calcula acá.
 */
export function PosCheckout({
  visible,
  total,
  saving,
  error,
  customer,
  creditEnabled,
  autoPrint,
  onAutoPrint,
  onCustomer,
  onClearCustomer,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  total: number;
  saving: boolean;
  error: string | null;
  /** Cliente de la venta: se puede elegir o crear sin salir del cobro. */
  customer: PosCustomer | null;
  /** El plan y el rol incluyen créditos. */
  creditEnabled: boolean;
  autoPrint: boolean;
  onAutoPrint: (value: boolean) => void;
  onCustomer: () => void;
  onClearCustomer: () => void;
  onClose: () => void;
  onConfirm: (payments: PaymentInput[], change: number, credit: CreditTerms | null) => void;
}) {
  const colors = usePalette();
  const [method, setMethod] = useState<PayMethod | 'mixed'>('cash');
  const [received, setReceived] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [reference, setReference] = useState('');
  // Mixto: una parte en efectivo y el resto con tarjeta o transferencia.
  const [mixCash, setMixCash] = useState('');
  const [mixOther, setMixOther] = useState<'card' | 'transfer'>('card');
  // Crédito: condiciones, entrega inicial y la línea del cliente.
  const [terms, setTerms] = useState<CreditTerms>(DEFAULT_TERMS);
  const [down, setDown] = useState('');
  const [downMethod, setDownMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [line, setLine] = useState<{ customerId: string; status: CreditStatus | null; error: string | null } | null>(null);

  const wantsCredit = method === 'credit' && Boolean(customer);
  useEffect(() => {
    if (!wantsCredit || !customer || line?.customerId === customer.id) return;
    let active = true;
    fetchCreditStatus(customer.id)
      .then((status) => active && setLine({ customerId: customer.id, status, error: null }))
      .catch((err) => active && setLine({ customerId: customer.id, status: null, error: err instanceof Error ? err.message : 'No se pudo leer el crédito del cliente.' }));
    return () => {
      active = false;
    };
  }, [wantsCredit, customer, line?.customerId]);

  const lineReady = Boolean(customer && line?.customerId === customer.id);
  const creditStatus = lineReady ? (line?.status ?? null) : null;
  const downAmount = method === 'credit' ? Math.min(total, digits(down)) : 0;
  const plan = buildCreditPlan(total - downAmount, terms);
  const minimumDown = creditStatus ? minimumDownPayment(total, creditStatus.available, terms.interestRate) : null;
  const methods = METHODS.filter((item) => item.key !== 'credit' || creditEnabled);

  const receivedAmount = digits(received);
  const change = method === 'cash' && receivedAmount > total ? receivedAmount - total : 0;
  const cashPart = Math.min(total, digits(mixCash));
  const otherPart = total - cashPart;

  const problem = (() => {
    if (method === 'cash') return receivedAmount > 0 && receivedAmount < total ? `Faltan ${formatGs(total - receivedAmount)}.` : null;
    if (method === 'card') return !/^\d{4}$/.test(cardLast4) ? 'Anotá los últimos 4 dígitos de la tarjeta.' : null;
    if (method === 'transfer') return !reference.trim() ? 'Anotá la referencia de la transferencia.' : null;
    if (method === 'credit') {
      if (!customer) return 'Elegí el cliente: la venta a crédito necesita uno.';
      if (!lineReady) return 'Revisando la línea de crédito del cliente…';
      if (!creditStatus) return line?.error ?? 'No se pudo leer el crédito del cliente.';
      if (creditStatus.limit <= 0) return 'El cliente no tiene línea de crédito.';
      if (downAmount >= total) return 'La entrega cubre todo: cobrá con otro medio.';
      if (downAmount > 0 && downMethod === 'card' && !/^\d{4}$/.test(cardLast4)) return 'Anotá los últimos 4 dígitos de la tarjeta de la entrega.';
      if (downAmount > 0 && downMethod === 'transfer' && !reference.trim()) return 'Anotá la referencia de la transferencia de la entrega.';
      const firstError = firstPaymentError(terms.firstPayment, plan.installments[0]?.amount ?? 0, terms.timing);
      if (firstError) return firstError;
      if (plan.financedTotal > creditStatus.available) return `El disponible (${formatGs(creditStatus.available)}) no cubre ${formatGs(plan.financedTotal)}.`;
      return null;
    }
    if (cashPart <= 0 || otherPart <= 0) return 'Repartí el total entre efectivo y el otro medio.';
    if (mixOther === 'card' && !/^\d{4}$/.test(cardLast4)) return 'Anotá los últimos 4 dígitos de la tarjeta.';
    if (mixOther === 'transfer' && !reference.trim()) return 'Anotá la referencia de la transferencia.';
    return null;
  })();

  const confirm = () => {
    if (problem) return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (method === 'credit') {
      const payments: PaymentInput[] = [
        ...(downAmount > 0 ? [{ method: downMethod, amount: downAmount, cardLast4, reference }] : []),
        { method: 'credit', amount: total - downAmount },
      ];
      return onConfirm(payments, 0, terms.timing === 'at_start' ? terms : { ...terms, firstPayment: null });
    }
    const payments: PaymentInput[] =
      method === 'mixed'
        ? [
            { method: 'cash', amount: cashPart },
            { method: mixOther, amount: otherPart, cardLast4, reference },
          ]
        : [{ method, amount: total, cardLast4, reference }];
    onConfirm(payments, change, null);
  };

  return (
    <BottomSheet
      visible={visible}
      title="Cobrar venta"
      onClose={() => !saving && onClose()}
      footer={
        <View style={styles.footer}>
          {problem ? <Text style={[styles.small, styles.center, { color: colors.muted }]}>{problem}</Text> : null}
          <Pressable onPress={confirm} disabled={saving} style={[styles.confirm, { opacity: saving || problem ? 0.55 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={22} color="#fff" />}
            <Text style={styles.confirmText}>
              {saving
                ? 'Cobrando…'
                : method === 'credit'
                  ? (() => {
                      const now = downAmount + (terms.firstPayment && terms.timing === 'at_start' ? (plan.installments[0]?.amount ?? 0) : 0);
                      return now > 0 ? `Cobrar ${formatGs(now)} y financiar` : 'Confirmar venta a crédito';
                    })()
                  : `Cobrar ${formatGs(total)}`}
            </Text>
          </Pressable>
        </View>
      }>
      <View style={[styles.totalBox, { backgroundColor: palette.primary }]}>
        <Text style={styles.totalLabel}>Total a cobrar</Text>
        <Text style={styles.totalValue}>{formatGs(total)}</Text>
      </View>

      <Pressable
        onPress={onCustomer}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={customer ? `Cliente: ${customer.name}. Cambiar` : 'Agregar cliente a la venta'}
        style={[styles.customer, { borderColor: customer ? palette.primary : colors.border, backgroundColor: customer ? 'rgba(37,99,235,0.06)' : colors.background }]}>
        <View style={[styles.customerIcon, { backgroundColor: customer ? palette.primary : colors.card }]}>
          <Ionicons name={customer ? 'person' : 'person-add-outline'} size={18} color={customer ? '#fff' : colors.muted} />
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.customerName, { color: colors.text }]}>{customer?.name ?? 'Agregar cliente'}</Text>
          <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
            {customer
              ? [customer.ruc ? `CI/RUC ${customer.ruc}` : null, customer.phone, isWholesaleCustomer(customer) ? 'Mayorista' : null].filter(Boolean).join(' · ') || 'Sin datos de contacto'
              : 'Consumidor final · buscalo o crealo para el comprobante'}
          </Text>
        </View>
        {customer ? (
          <Pressable onPress={onClearCustomer} hitSlop={10} accessibilityLabel="Quitar cliente">
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        )}
      </Pressable>

      <View style={styles.methods}>
        {methods.map((item) => {
          const selected = method === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setMethod(item.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.method, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.background }]}>
              <Ionicons name={item.icon} size={22} color={selected ? palette.primary : colors.muted} />
              <Text style={[styles.methodText, { color: selected ? palette.primary : colors.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {method === 'cash' && (
        <>
          <MoneyField label="Recibido (opcional, para el vuelto)" value={received} onChange={setReceived} colors={colors} />
          <View style={styles.bills}>
            {quickBills(total).map((amount) => (
              <Pressable key={amount} onPress={() => setReceived(pretty(amount))} style={[styles.bill, { borderColor: receivedAmount === amount ? palette.primary : colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.billText, { color: receivedAmount === amount ? palette.primary : colors.text }]}>{amount === total ? 'Exacto' : formatGs(amount)}</Text>
              </Pressable>
            ))}
          </View>
          {change > 0 && (
            <View style={[styles.change, { backgroundColor: '#16A34A14', borderColor: '#16A34A55' }]}>
              <Text style={[styles.changeLabel, { color: '#16A34A' }]}>Vuelto</Text>
              <Text style={[styles.changeValue, { color: '#16A34A' }]}>{formatGs(change)}</Text>
            </View>
          )}
        </>
      )}

      {method === 'credit' &&
        (customer ? (
          <PosCreditPanel
            status={creditStatus}
            loading={!lineReady}
            error={lineReady ? (line?.error ?? null) : null}
            terms={terms}
            onTerms={setTerms}
            down={down}
            onDown={setDown}
            downMethod={downMethod}
            onDownMethod={setDownMethod}
            plan={plan}
            minimumDown={minimumDown}
            colors={colors}
          />
        ) : (
          <Pressable onPress={onCustomer} style={[styles.errorBox, { borderColor: '#2563EB55', backgroundColor: 'rgba(37,99,235,0.06)' }]}>
            <Ionicons name="person-add-outline" size={18} color={palette.primary} />
            <Text style={[styles.errorText, { color: palette.primary }]}>Elegí o creá el cliente para venderle a crédito.</Text>
          </Pressable>
        ))}

      {(method === 'card' || (method === 'mixed' && mixOther === 'card') || (method === 'credit' && downAmount > 0 && downMethod === 'card')) && (
        <Field label="Últimos 4 dígitos de la tarjeta" colors={colors}>
          <TextInput value={cardLast4} onChangeText={(value) => setCardLast4(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="1234" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
        </Field>
      )}
      {(method === 'transfer' || (method === 'mixed' && mixOther === 'transfer') || (method === 'credit' && downAmount > 0 && downMethod === 'transfer')) && (
        <Field label="Referencia de la transferencia" colors={colors}>
          <TextInput value={reference} onChangeText={setReference} autoCapitalize="characters" placeholder="N.º de operación" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
        </Field>
      )}

      {method === 'mixed' && (
        <>
          <MoneyField label="Parte en efectivo" value={mixCash} onChange={setMixCash} colors={colors} />
          <View style={styles.methods}>
            {(['card', 'transfer'] as const).map((key) => (
              <Pressable key={key} onPress={() => setMixOther(key)} style={[styles.chip, { borderColor: mixOther === key ? palette.primary : colors.border, backgroundColor: mixOther === key ? 'rgba(37,99,235,0.08)' : colors.background }]}>
                <Text style={[styles.billText, { color: mixOther === key ? palette.primary : colors.text }]}>Resto con {key === 'card' ? 'tarjeta' : 'transferencia'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.split, { borderColor: colors.border }]}>
            <Text style={[styles.small, { color: colors.muted }]}>Efectivo {formatGs(cashPart)}</Text>
            <Text style={[styles.small, { color: colors.muted }]}>+ {mixOther === 'card' ? 'Tarjeta' : 'Transferencia'} {formatGs(Math.max(0, otherPart))}</Text>
          </View>
        </>
      )}

      <View style={[styles.printRow, { borderColor: colors.border }]}>
        <Ionicons name="print-outline" size={20} color={colors.muted} />
        <View style={styles.flex}>
          <Text style={[styles.customerName, { color: colors.text }]}>Imprimir comprobante al cobrar</Text>
          <Text style={[styles.small, { color: colors.muted }]}>Abre la impresión apenas se confirma la venta</Text>
        </View>
        <Switch value={autoPrint} onValueChange={onAutoPrint} />
      </View>

      {error && (
        <View style={[styles.errorBox, { borderColor: '#DC262655', backgroundColor: '#DC262610' }]}>
          <Ionicons name="alert-circle" size={18} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </BottomSheet>
  );
}

function Field({ label, colors, children }: { label: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

function MoneyField({ label, value, onChange, colors }: { label: string; value: string; onChange: (value: string) => void; colors: Colors }) {
  return (
    <Field label={label} colors={colors}>
      <View style={[styles.moneyWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
        <TextInput value={value} onChangeText={(next) => onChange(pretty(next))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[styles.moneyInput, { color: colors.text }]} />
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  customer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 10 },
  customerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 14, fontWeight: '800' },
  printRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  small: { fontSize: 12 },
  center: { textAlign: 'center' },
  footer: { gap: 6 },
  confirm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16A34A', borderRadius: 16, minHeight: 58 },
  confirmText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  totalBox: { borderRadius: 18, padding: 16, alignItems: 'center' },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  totalValue: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: { width: '48.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  methodText: { fontSize: 14, fontWeight: '800' },
  bills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bill: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  billText: { fontSize: 13, fontWeight: '800' },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  change: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14 },
  changeLabel: { fontSize: 15, fontWeight: '800' },
  changeValue: { fontSize: 24, fontWeight: '900' },
  split: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  moneyWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontSize: 15, fontWeight: '700' },
  moneyInput: { flex: 1, fontSize: 18, fontWeight: '800', paddingVertical: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  errorText: { flex: 1, color: palette.danger, fontSize: 13, fontWeight: '700' },
});
