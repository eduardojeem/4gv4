import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { addCashMovement, closeCashRegister, fetchTodaySales, SALE_METHOD, type PosSession, type SaleRow } from '@/lib/pos';

type Colors = ReturnType<typeof usePalette>;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};
const hour = (iso: string) => new Date(iso).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

const MOVEMENT: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; sign: 1 | -1 | 0 }> = {
  opening: { label: 'Apertura', icon: 'lock-open-outline', color: '#2563EB', sign: 1 },
  sale: { label: 'Venta', icon: 'cart-outline', color: '#16A34A', sign: 1 },
  cash_in: { label: 'Ingreso', icon: 'arrow-down-circle-outline', color: '#16A34A', sign: 1 },
  cash_out: { label: 'Egreso', icon: 'arrow-up-circle-outline', color: '#DC2626', sign: -1 },
};

const QUICK_REASONS = {
  cash_in: ['Cambio para la caja', 'Aporte del dueño', 'Cobro de otra deuda'],
  cash_out: ['Pago a proveedor', 'Compra de insumos', 'Retiro del dueño', 'Delivery / transporte'],
};

/**
 * La caja del turno, como /dashboard/pos/caja: cuánto se vendió por medio de
 * pago, cuánto efectivo tiene que haber, ingresos y egresos con motivo, y el
 * cierre con el arqueo (lo contado contra lo esperado).
 */
export function CashSheet({
  session,
  initialMode = 'summary',
  onClose,
  onChanged,
  onClosed,
}: {
  session: PosSession;
  /** Abre directo en un ingreso, egreso o cierre (desde la sección Caja). */
  initialMode?: 'summary' | 'cash_in' | 'cash_out' | 'close';
  onClose: () => void;
  onChanged: () => void;
  onClosed: () => void;
}) {
  const colors = usePalette();
  const summary = session.summary;
  const [mode, setMode] = useState<'summary' | 'cash_in' | 'cash_out' | 'close'>(initialMode);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expected = summary?.expectedCash ?? session.session?.openingBalance ?? 0;
  const counted = digits(amount);
  const difference = counted - expected;

  const reset = (next: typeof mode) => {
    setMode(next);
    setAmount('');
    setReason('');
    setError(null);
  };

  const saveMovement = async () => {
    if (mode !== 'cash_in' && mode !== 'cash_out') return;
    if (counted <= 0) return setError('Escribí el monto.');
    if (!reason.trim()) return setError('Indicá el motivo.');
    setSaving(true);
    setError(null);
    try {
      await addCashMovement({ session, type: mode, amount: counted, reason });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset('summary');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar.');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!amount) return setError('Contá el efectivo del cajón y escribilo.');
    Alert.alert(
      'Cerrar caja',
      difference === 0
        ? `Cuadra justo: ${formatGs(counted)}. ¿Cerrar la caja?`
        : `${difference > 0 ? 'Sobran' : 'Faltan'} ${formatGs(Math.abs(difference))}. Queda registrado en el cierre. ¿Cerrar igual?`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cerrar caja',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            setError(null);
            try {
              await closeCashRegister({ session, closingBalance: counted });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onClosed();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo cerrar la caja.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const opened = session.session?.openedAt ? new Date(session.session.openedAt) : null;

  if (mode === 'cash_in' || mode === 'cash_out') {
    const config = MOVEMENT[mode];
    return (
      <BottomSheet
        visible
        title={mode === 'cash_in' ? 'Ingreso de efectivo' : 'Egreso de efectivo'}
        subtitle={mode === 'cash_in' ? 'Plata que entra a la caja sin ser una venta.' : 'Plata que sale de la caja: pagos, retiros, gastos.'}
        onClose={() => !saving && onClose()}
        footer={
          <View style={styles.footer}>
            <Pressable onPress={() => reset('summary')} style={[styles.ghost, { borderColor: colors.border }]}>
              <Text style={[styles.bold, { color: colors.text }]}>Volver</Text>
            </Pressable>
            <Pressable onPress={saveMovement} disabled={saving} style={[styles.solid, { backgroundColor: config.color, opacity: saving ? 0.6 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.solidText}>Registrar {counted > 0 ? formatGs(counted) : ''}</Text>}
            </Pressable>
          </View>
        }>
        <Money value={amount} onChange={setAmount} colors={colors} />
        <View style={styles.chips}>
          {QUICK_REASONS[mode].map((text) => (
            <Pressable key={text} onPress={() => setReason(text)} style={[styles.chip, { borderColor: reason === text ? config.color : colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.chipText, { color: reason === text ? config.color : colors.text }]}>{text}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={reason} onChangeText={setReason} placeholder="Motivo" placeholderTextColor={colors.muted} maxLength={500} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
        {error && <Text style={styles.error}>{error}</Text>}
      </BottomSheet>
    );
  }

  if (mode === 'close') {
    return (
      <BottomSheet
        visible
        title="Cerrar caja"
        subtitle="Contá el efectivo del cajón. Tarjeta y transferencias no se cuentan."
        onClose={() => !saving && onClose()}
        footer={
          <View style={styles.footer}>
            <Pressable onPress={() => reset('summary')} style={[styles.ghost, { borderColor: colors.border }]}>
              <Text style={[styles.bold, { color: colors.text }]}>Volver</Text>
            </Pressable>
            <Pressable onPress={close} disabled={saving} style={[styles.solid, { backgroundColor: palette.danger, opacity: saving ? 0.6 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.solidText}>Cerrar caja</Text>}
            </Pressable>
          </View>
        }>
        <View style={[styles.expected, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.small, { color: colors.muted }]}>Efectivo que debería haber</Text>
          <Text style={[styles.expectedValue, { color: colors.text }]}>{formatGs(expected)}</Text>
        </View>
        <Money value={amount} onChange={setAmount} colors={colors} label="Efectivo contado" />
        {amount !== '' && (
          <View style={[styles.diff, { backgroundColor: difference === 0 ? '#16A34A14' : difference > 0 ? '#2563EB14' : '#DC262614' }]}>
            <Ionicons name={difference === 0 ? 'checkmark-circle' : 'alert-circle'} size={18} color={difference === 0 ? '#16A34A' : difference > 0 ? '#2563EB' : palette.danger} />
            <Text style={[styles.bold, { color: difference === 0 ? '#16A34A' : difference > 0 ? '#2563EB' : palette.danger }]}>
              {difference === 0 ? 'La caja cuadra' : `${difference > 0 ? 'Sobran' : 'Faltan'} ${formatGs(Math.abs(difference))}`}
            </Text>
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible tall title={session.session?.registerName ?? 'Caja'} subtitle={`${session.branch.name}${opened ? ` · abierta a las ${hour(opened.toISOString())}` : ''}`} onClose={onClose}>
      <View style={[styles.hero, { backgroundColor: palette.primary }]}>
        <Text style={styles.heroLabel}>Vendido en el turno</Text>
        <Text style={styles.heroValue}>{formatGs(summary?.salesTotal ?? 0)}</Text>
        <Text style={styles.heroHelp}>{summary?.salesCount ?? 0} {summary?.salesCount === 1 ? 'venta' : 'ventas'}</Text>
      </View>
      <View style={styles.grid}>
        <Stat label="Efectivo" value={summary?.cash ?? 0} icon="cash-outline" colors={colors} />
        <Stat label="Tarjeta" value={summary?.card ?? 0} icon="card-outline" colors={colors} />
        <Stat label="Transferencia" value={summary?.transfer ?? 0} icon="swap-horizontal-outline" colors={colors} />
        <Stat label="En el cajón" value={expected} icon="file-tray-full-outline" colors={colors} strong />
      </View>
      <Text style={[styles.small, { color: colors.muted }]}>
        Apertura {formatGs(session.session?.openingBalance ?? 0)} · ingresos {formatGs(summary?.cashIn ?? 0)} · egresos {formatGs(summary?.cashOut ?? 0)}
      </Text>

      {session.permissions.manageCash && (
        <View style={styles.actions}>
          <Action label="Ingreso" icon="arrow-down-circle-outline" color="#16A34A" onPress={() => reset('cash_in')} colors={colors} />
          <Action label="Egreso" icon="arrow-up-circle-outline" color="#DC2626" onPress={() => reset('cash_out')} colors={colors} />
          <Action label="Cerrar caja" icon="lock-closed-outline" color={colors.text} onPress={() => reset('close')} colors={colors} />
        </View>
      )}

      <Text style={[styles.section, { color: colors.text }]}>Movimientos</Text>
      {(summary?.movements ?? []).length === 0 && <Text style={[styles.small, { color: colors.muted }]}>Todavía no hay movimientos.</Text>}
      {(summary?.movements ?? []).map((movement) => {
        const config = MOVEMENT[movement.type] ?? { label: movement.type, icon: 'ellipse-outline', color: colors.muted, sign: 0 };
        return (
          <View key={movement.id} style={[styles.movement, { borderColor: colors.border }]}>
            <Ionicons name={config.icon} size={18} color={config.color} />
            <View style={styles.flex}>
              <Text style={[styles.bold, { color: colors.text }]}>
                {config.label}
                {movement.type === 'sale' && movement.method ? ` · ${SALE_METHOD[movement.method] ?? movement.method}` : ''}
              </Text>
              <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
                {hour(movement.at)}
                {movement.reason ? ` · ${movement.reason}` : ''}
              </Text>
            </View>
            <Text style={[styles.bold, { color: config.sign < 0 ? palette.danger : colors.text }]}>
              {config.sign < 0 ? '− ' : ''}
              {formatGs(movement.amount)}
            </Text>
          </View>
        );
      })}
    </BottomSheet>
  );
}

/** Ventas de hoy (de toda la organización), con su detalle. */
export function SalesSheet({ onClose }: { onClose: () => void }) {
  const colors = usePalette();
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchTodaySales()
      .then(setSales)
      .catch((err) => {
        setSales([]);
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las ventas.');
      });
  }, []);

  const valid = (sales ?? []).filter((sale) => sale.status !== 'cancelled' && sale.status !== 'voided');
  const total = valid.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);

  return (
    <BottomSheet visible tall title="Ventas de hoy" subtitle={sales ? `${valid.length} ventas · ${formatGs(total)}` : undefined} onClose={onClose}>
      {sales === null && <ActivityIndicator color={palette.primary} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {sales?.length === 0 && !error && <Text style={[styles.small, styles.center, { color: colors.muted }]}>Todavía no hay ventas hoy.</Text>}
      {sales?.map((sale) => {
        const customer = [sale.customer?.first_name, sale.customer?.last_name].filter(Boolean).join(' ');
        const expanded = open === sale.id;
        const cancelled = sale.status === 'cancelled' || sale.status === 'voided';
        return (
          <Pressable key={sale.id} onPress={() => setOpen(expanded ? null : sale.id)} style={[styles.sale, { borderColor: colors.border, opacity: cancelled ? 0.5 : 1 }]}>
            <View style={styles.saleTop}>
              <View style={styles.flex}>
                <Text style={[styles.bold, { color: colors.text }]}>
                  {hour(sale.created_at)} · {SALE_METHOD[String(sale.payment_method)] ?? sale.payment_method ?? '—'}
                </Text>
                <Text style={[styles.small, { color: colors.muted }]}>
                  {customer || 'Sin cliente'} · {(sale.sale_items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} artículos
                  {cancelled ? ' · Anulada' : ''}
                </Text>
              </View>
              <Text style={[styles.saleTotal, { color: colors.text }]}>{formatGs(Number(sale.total_amount || 0))}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </View>
            {expanded &&
              (sale.sale_items ?? []).map((item) => (
                <View key={item.id} style={styles.saleItem}>
                  <Text style={[styles.small, styles.flex, { color: colors.text }]}>
                    {item.quantity} × {item.product?.name ?? 'Producto'}
                  </Text>
                  <Text style={[styles.small, { color: colors.muted }]}>{formatGs(Number(item.subtotal ?? item.unit_price * item.quantity))}</Text>
                </View>
              ))}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

function Stat({ label, value, icon, colors, strong }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; colors: Colors; strong?: boolean }) {
  return (
    <View style={[styles.stat, { borderColor: strong ? palette.primary : colors.border, backgroundColor: colors.background }]}>
      <Ionicons name={icon} size={16} color={strong ? palette.primary : colors.muted} />
      <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: strong ? palette.primary : colors.text }]}>{formatGs(value)}</Text>
    </View>
  );
}

function Action({ label, icon, color, onPress, colors }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Money({ value, onChange, colors, label = 'Monto' }: { value: string; onChange: (value: string) => void; colors: Colors; label?: string }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.moneyWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.bold, { color: colors.muted }]}>Gs.</Text>
        <TextInput value={value} onChangeText={(next) => onChange(pretty(next))} keyboardType="number-pad" autoFocus placeholder="0" placeholderTextColor={colors.muted} style={[styles.moneyInput, { color: colors.text }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontSize: 14, fontWeight: '800' },
  small: { fontSize: 12 },
  center: { textAlign: 'center' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 10 },
  ghost: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  solid: { flex: 1, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  moneyWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  moneyInput: { flex: 1, fontSize: 22, fontWeight: '900', paddingVertical: 12 },
  expected: { borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  expectedValue: { fontSize: 26, fontWeight: '900' },
  diff: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  hero: { borderRadius: 18, padding: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  heroValue: { color: '#fff', fontSize: 30, fontWeight: '900' },
  heroHelp: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48.5%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  statValue: { fontSize: 16, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 14, paddingVertical: 12 },
  actionText: { fontSize: 13, fontWeight: '800' },
  section: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  movement: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  sale: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  saleTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saleTotal: { fontSize: 15, fontWeight: '900' },
  saleItem: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
});
