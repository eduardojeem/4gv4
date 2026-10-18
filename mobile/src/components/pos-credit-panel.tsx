import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { FREQUENCY_LABEL, shortDate, type CreditFrequency, type CreditPlan, type CreditStatus, type CreditTerms } from '@/lib/pos-credit';

type Colors = ReturnType<typeof usePalette>;

const COUNTS = [1, 2, 3, 4, 6, 9, 12];
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

/**
 * Venta a crédito en el cobro, como el panel de crédito del POS web: estado
 * de la línea del cliente, entrega inicial opcional, cuotas, frecuencia,
 * interés, inicio y el plan que se va a firmar.
 */
export function PosCreditPanel({
  status,
  loading,
  error,
  terms,
  onTerms,
  down,
  onDown,
  downMethod,
  onDownMethod,
  plan,
  minimumDown,
  colors,
}: {
  status: CreditStatus | null;
  loading: boolean;
  error: string | null;
  terms: CreditTerms;
  onTerms: (terms: CreditTerms) => void;
  down: string;
  onDown: (value: string) => void;
  downMethod: 'cash' | 'card' | 'transfer';
  onDownMethod: (method: 'cash' | 'card' | 'transfer') => void;
  plan: CreditPlan;
  minimumDown: number | null;
  colors: Colors;
}) {
  const [showAll, setShowAll] = useState(false);
  const [customCount, setCustomCount] = useState(!COUNTS.includes(terms.count));

  if (loading) return <ActivityIndicator color={palette.primary} />;
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!status) return null;

  if (status.limit <= 0) {
    return (
      <View style={[styles.notice, { borderColor: '#D9770655', backgroundColor: '#D9770612' }]}>
        <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
        <Text style={[styles.small, styles.flex, { color: colors.text }]}>
          Este cliente no tiene línea de crédito. Asignale un límite en su ficha desde la web para venderle en cuotas.
        </Text>
      </View>
    );
  }

  const enough = plan.financedTotal <= status.available;
  const shown = showAll ? plan.installments : plan.installments.slice(0, 3);
  const first = plan.installments[0];
  const last = plan.installments[plan.installments.length - 1];
  const sameAmount = plan.installments.every((row) => row.amount === first.amount);

  return (
    <View style={styles.wrap}>
      <View style={[styles.line, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Stat label="Límite" value={formatGs(status.limit)} colors={colors} />
        <Stat label="Usado" value={formatGs(status.used)} colors={colors} tone={status.used ? '#D97706' : undefined} />
        <Stat label="Disponible" value={formatGs(status.available)} colors={colors} tone={enough ? palette.success : palette.danger} />
      </View>
      {status.overdue > 0 && (
        <Text style={[styles.small, { color: palette.danger, fontWeight: '700' }]}>Tiene {formatGs(status.overdue)} en cuotas vencidas.</Text>
      )}

      <Text style={[styles.label, { color: colors.text }]}>Entrega inicial (opcional)</Text>
      <View style={[styles.money, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
        <TextInput value={down} onChangeText={(value) => onDown(pretty(value))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[styles.moneyInput, { color: colors.text }]} />
      </View>
      {Number(down.replace(/\D/g, '')) > 0 && (
        <View style={styles.chips}>
          {(['cash', 'card', 'transfer'] as const).map((key) => (
            <Chip key={key} label={key === 'cash' ? 'Efectivo' : key === 'card' ? 'Tarjeta' : 'Transferencia'} selected={downMethod === key} onPress={() => onDownMethod(key)} colors={colors} />
          ))}
        </View>
      )}
      {minimumDown !== null && !enough && (
        <Pressable onPress={() => onDown(pretty(minimumDown))} style={[styles.notice, { borderColor: '#DC262655', backgroundColor: '#DC262610' }]}>
          <Ionicons name="information-circle-outline" size={18} color={palette.danger} />
          <Text style={[styles.small, styles.flex, { color: colors.text }]}>
            El disponible no alcanza. Con una entrega de <Text style={styles.bold}>{formatGs(minimumDown)}</Text> entra. Tocá para usarla.
          </Text>
        </Pressable>
      )}

      <Text style={[styles.label, { color: colors.text }]}>Cuotas</Text>
      <View style={styles.chips}>
        {COUNTS.map((count) => (
          <Chip
            key={count}
            label={String(count)}
            selected={!customCount && terms.count === count}
            onPress={() => {
              setCustomCount(false);
              onTerms({ ...terms, count });
            }}
            colors={colors}
          />
        ))}
        <Chip label="Otra" selected={customCount} onPress={() => setCustomCount(true)} colors={colors} />
      </View>
      {customCount && (
        <TextInput
          value={String(terms.count)}
          onChangeText={(value) => onTerms({ ...terms, count: Math.min(60, Math.max(1, Number(value.replace(/\D/g, '')) || 1)) })}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="Cantidad de cuotas (1 a 60)"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        />
      )}

      <View style={styles.pair}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: colors.text }]}>Frecuencia</Text>
          <View style={styles.chips}>
            {(Object.keys(FREQUENCY_LABEL) as CreditFrequency[]).map((key) => (
              <Chip key={key} label={FREQUENCY_LABEL[key]} selected={terms.frequency === key} onPress={() => onTerms({ ...terms, frequency: key })} colors={colors} small />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.pair}>
        <View style={styles.rate}>
          <Text style={[styles.label, { color: colors.text }]}>Interés %</Text>
          <TextInput
            value={terms.interestRate ? String(terms.interestRate) : ''}
            onChangeText={(value) => {
              const rate = Number(value.replace(',', '.').replace(/[^\d.]/g, ''));
              onTerms({ ...terms, interestRate: Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 0 });
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: colors.text }]}>Primera cuota</Text>
          <View style={styles.chips}>
            <Chip label="Hoy" selected={terms.timing === 'at_start'} onPress={() => onTerms({ ...terms, timing: 'at_start' })} colors={colors} small />
            <Chip label="Próximo ciclo" selected={terms.timing === 'next_cycle'} onPress={() => onTerms({ ...terms, timing: 'next_cycle', firstPayment: null })} colors={colors} small />
          </View>
        </View>
      </View>

      <FirstPaymentFields terms={terms} onTerms={onTerms} amount={first.amount} colors={colors} />

      <View style={[styles.plan, { borderColor: enough ? '#2563EB44' : '#DC262655', backgroundColor: enough ? 'rgba(37,99,235,0.05)' : '#DC262608' }]}>
        <Text style={[styles.planTitle, { color: colors.text }]}>
          {plan.installments.length} {plan.installments.length === 1 ? 'cuota' : 'cuotas'} {FREQUENCY_LABEL[terms.frequency].toLowerCase()}
          {sameAmount ? ` de ${formatGs(first.amount)}` : ` de ${formatGs(first.amount)} (última ${formatGs(last.amount)})`}
        </Text>
        <View style={styles.planRow}>
          <Text style={[styles.small, { color: colors.muted }]}>Financiado</Text>
          <Text style={[styles.small, styles.bold, { color: colors.text }]}>{formatGs(plan.principal)}</Text>
        </View>
        {plan.interestAmount > 0 && (
          <View style={styles.planRow}>
            <Text style={[styles.small, { color: colors.muted }]}>Interés {terms.interestRate}%</Text>
            <Text style={[styles.small, styles.bold, { color: colors.text }]}>{formatGs(plan.interestAmount)}</Text>
          </View>
        )}
        <View style={styles.planRow}>
          <Text style={[styles.bold, { color: colors.text }]}>Total en cuotas</Text>
          <Text style={[styles.bold, { color: enough ? colors.text : palette.danger }]}>{formatGs(plan.financedTotal)}</Text>
        </View>
        <View style={[styles.sep, { borderColor: colors.border }]} />
        {shown.map((row) => (
          <View key={row.number} style={styles.planRow}>
            <Text style={[styles.small, { color: colors.muted }]}>
              Cuota {row.number} · {shortDate(row.dueDate)}
            </Text>
            <Text style={[styles.small, { color: colors.text }]}>{formatGs(row.amount)}</Text>
          </View>
        ))}
        {plan.installments.length > 3 && (
          <Pressable onPress={() => setShowAll((value) => !value)} hitSlop={6}>
            <Text style={[styles.small, { color: palette.primary, fontWeight: '800' }]}>{showAll ? 'Ver menos' : `Ver las ${plan.installments.length} cuotas`}</Text>
          </Pressable>
        )}
        <Text style={[styles.tiny, { color: colors.muted }]}>El calendario final lo confirma el sistema al registrar la venta.</Text>
      </View>
    </View>
  );
}

function FirstPaymentFields({ terms, onTerms, amount, colors }: { terms: CreditTerms; onTerms: (terms: CreditTerms) => void; amount: number; colors: Colors }) {
  const available = terms.timing === 'at_start';
  const payment = available ? terms.firstPayment : null;
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }];
  return (
    <View style={[styles.first, { borderColor: payment ? palette.primary : colors.border }]}>
      <View style={styles.firstHead}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: colors.text }]}>Cobrar la primera cuota ahora</Text>
          <Text style={[styles.tiny, { color: colors.muted }]}>
            {available ? `Cancela la cuota 1 (${formatGs(amount)}). No cambia las demás.` : 'Solo si las cuotas empiezan hoy.'}
          </Text>
        </View>
        <Switch
          value={Boolean(payment)}
          disabled={!available}
          onValueChange={(on) => onTerms({ ...terms, firstPayment: on ? { method: 'cash', cashReceived: amount } : null })}
        />
      </View>
      {payment && (
        <>
          <View style={styles.chips}>
            <Chip label="Efectivo" selected={payment.method === 'cash'} onPress={() => onTerms({ ...terms, firstPayment: { method: 'cash', cashReceived: amount } })} colors={colors} small />
            <Chip label="Transferencia" selected={payment.method === 'transfer'} onPress={() => onTerms({ ...terms, firstPayment: { method: 'transfer', bank: '', reference: '' } })} colors={colors} small />
          </View>
          {payment.method === 'cash' ? (
            <>
              <View style={[styles.money, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
                <TextInput
                  value={pretty(payment.cashReceived)}
                  onChangeText={(value) => onTerms({ ...terms, firstPayment: { method: 'cash', cashReceived: Number(value.replace(/\D/g, '')) || 0 } })}
                  keyboardType="number-pad"
                  accessibilityLabel="Efectivo recibido para la cuota"
                  style={[styles.moneyInput, { color: colors.text }]}
                />
              </View>
              {payment.cashReceived > amount && <Text style={[styles.small, { color: palette.success, fontWeight: '800' }]}>Vuelto de la cuota: {formatGs(payment.cashReceived - amount)}</Text>}
            </>
          ) : (
            <View style={styles.pair}>
              <TextInput value={payment.bank} onChangeText={(bank) => onTerms({ ...terms, firstPayment: { ...payment, bank } })} maxLength={120} placeholder="Banco o cuenta" placeholderTextColor={colors.muted} style={[inputStyle, styles.flex]} />
              <TextInput value={payment.reference} onChangeText={(reference) => onTerms({ ...terms, firstPayment: { ...payment, reference } })} maxLength={120} autoCapitalize="characters" placeholder="Referencia" placeholderTextColor={colors.muted} style={[inputStyle, styles.flex]} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

function Stat({ label, value, tone, colors }: { label: string; value: string; tone?: string; colors: Colors }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.tiny, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: tone ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, selected, onPress, colors, small }: { label: string; selected: boolean; onPress: () => void; colors: Colors; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, small && styles.chipSmall, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.background }]}>
      <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 10 },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  line: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 10, gap: 6 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 14, fontWeight: '900' },
  money: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontSize: 15, fontWeight: '700' },
  moneyInput: { flex: 1, fontSize: 18, fontWeight: '800', paddingVertical: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minWidth: 40, alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  pair: { flexDirection: 'row', gap: 12 },
  rate: { width: 96, gap: 6 },
  plan: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 5 },
  first: { borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 10 },
  firstHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planTitle: { fontSize: 15, fontWeight: '900' },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 4 },
});
