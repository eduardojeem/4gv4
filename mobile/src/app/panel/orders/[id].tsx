import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import {
  cachedOrder,
  changeOrderStatus,
  collectOrderPayment,
  fetchOrder,
  fetchOrderHistory,
  nextOrderStatus,
  notifyOrder,
  ORDER_FLOW,
  ORDER_STATUS,
  PAYMENT_LABEL,
  uuid,
  type Order,
  type OrderEvent,
  type OrderStatus,
} from '@/lib/pos';

type Colors = ReturnType<typeof usePalette>;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};
const when = (iso: string) => new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Teléfono para wa.me: solo dígitos, con 595 si viene en formato local. */
const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('595') ? d : d.startsWith('0') ? `595${d.slice(1)}` : d;
};

const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Confirmar pedido',
  PREPARING: 'Empezar a preparar',
  READY: 'Marcar listo',
  SHIPPED: 'Marcar enviado',
  DELIVERED: 'Marcar entregado',
};

export default function OrderDetail() {
  const colors = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | undefined>(() => (id ? cachedOrder(id) : undefined));
  const [history, setHistory] = useState<OrderEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([fetchOrder(id), fetchOrderHistory(id).catch(() => [])])
      .then(([fresh, events]) => {
        if (!active) return;
        setOrder(fresh);
        setHistory(events);
        notifyOrder(fresh);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo cargar el pedido.'));
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/panel/orders' as never));

  if (!order) {
    return (
      <View style={styles.center}>
        {error ? <Text style={[styles.muted, { color: colors.muted }]}>{error}</Text> : <ActivityIndicator color={palette.primary} />}
      </View>
    );
  }

  const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.PENDING;
  const payment = PAYMENT_LABEL[String(order.payment_status).toUpperCase()] ?? PAYMENT_LABEL.PENDING;
  const next = nextOrderStatus(order);
  const closed = order.status === 'DELIVERED' || order.status === 'CANCELLED';
  const step = ORDER_FLOW.indexOf(order.status);
  const flow = order.fulfillment_type === 'PICKUP' ? ORDER_FLOW.filter((s) => s !== 'SHIPPED') : ORDER_FLOW;

  const apply = (updated: Order, message: string) => {
    setOrder(updated);
    notifyOrder(updated);
    setNotice(message);
    setAttempt((n) => n + 1);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const move = async (to: OrderStatus, note?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const updated = await changeOrderStatus(order.id, to, note);
      apply(updated, `Pedido ${ORDER_STATUS[to].label.toLowerCase()}.`);
    } catch (err) {
      Alert.alert('No se pudo cambiar el estado', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = () =>
    Alert.alert('Cancelar pedido', `¿Cancelar el pedido #${order.order_number}? Se libera el stock reservado.`, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar pedido', style: 'destructive', onPress: () => void move('CANCELLED') },
    ]);

  const whatsapp = () => {
    if (!order.customer_phone) return;
    const text = `Hola ${order.customer_name}, te escribimos por tu pedido #${order.order_number}. Estado: ${status.label}.`;
    void Linking.openURL(`https://wa.me/${waNumber(order.customer_phone)}?text=${encodeURIComponent(text)}`);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={back} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>Pedido #{order.order_number}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {notice && (
          <View style={[styles.notice, { borderColor: '#16A34A55', backgroundColor: '#16A34A12' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.noticeText, { color: '#16A34A' }]}>{notice}</Text>
          </View>
        )}

        {/* Estado */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <View style={[styles.badge, { backgroundColor: `${status.color}1A` }]}>
              <Ionicons name={status.icon as keyof typeof Ionicons.glyphMap} size={14} color={status.color} />
              <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
            <Text style={[styles.small, { color: colors.muted }]}>{when(order.created_at)}</Text>
          </View>
          {order.status !== 'CANCELLED' && (
            <View style={styles.timeline}>
              {flow.map((item) => {
                const done = ORDER_FLOW.indexOf(item) <= step;
                return (
                  <View key={item} style={styles.step}>
                    <View style={[styles.stepDot, { backgroundColor: done ? status.color : colors.card, borderColor: done ? status.color : colors.border }]}>
                      {done && <Ionicons name="checkmark" size={10} color="#fff" />}
                    </View>
                    <Text numberOfLines={1} style={[styles.stepLabel, { color: done ? colors.text : colors.muted }]}>{ORDER_STATUS[item].label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <Text style={[styles.small, { color: colors.muted }]}>
            {order.fulfillment_type === 'DELIVERY' ? 'Envío a domicilio' : 'Retiro en el local'}
            {order.estimated_delivery_date ? ` · estimado ${new Date(order.estimated_delivery_date).toLocaleDateString('es-PY')}` : ''}
          </Text>

          {!closed && (
            <View style={styles.actions}>
              {next && (
                <Pressable onPress={() => void move(next)} disabled={busy} style={[styles.primary, { backgroundColor: ORDER_STATUS[next].color, opacity: busy ? 0.6 : 1 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name={ORDER_STATUS[next].icon as keyof typeof Ionicons.glyphMap} size={18} color="#fff" />}
                  <Text style={styles.primaryText}>{NEXT_ACTION[next] ?? `Pasar a ${ORDER_STATUS[next].label}`}</Text>
                </Pressable>
              )}
              <Pressable onPress={confirmCancel} disabled={busy} style={[styles.secondary, { borderColor: '#DC262655' }]}>
                <Text style={[styles.secondaryText, { color: palette.danger }]}>Cancelar pedido</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Cliente */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Head title="Cliente" icon="person-outline" colors={colors} />
          <Text style={[styles.name, { color: colors.text }]}>{order.customer_name || 'Cliente'}</Text>
          {order.customer_phone ? <Text style={[styles.small, { color: colors.muted }]}>{order.customer_phone}</Text> : null}
          {order.customer_email ? <Text style={[styles.small, { color: colors.muted }]}>{order.customer_email}</Text> : null}
          {order.customer_address ? (
            <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(order.customer_address!)}`)} style={styles.address}>
              <Ionicons name="location-outline" size={15} color={palette.primary} />
              <Text style={[styles.small, styles.flex, { color: palette.primary }]}>{order.customer_address}</Text>
            </Pressable>
          ) : null}
          {order.customer_phone ? (
            <View style={styles.contactRow}>
              <Pressable onPress={() => Linking.openURL(`tel:${order.customer_phone!.replace(/[^\d+]/g, '')}`)} style={[styles.contact, { borderColor: colors.border }]}>
                <Ionicons name="call-outline" size={17} color={colors.text} />
                <Text style={[styles.secondaryText, { color: colors.text }]}>Llamar</Text>
              </Pressable>
              <Pressable onPress={whatsapp} style={[styles.contact, { borderColor: '#16A34A66', backgroundColor: '#16A34A12' }]}>
                <Ionicons name="logo-whatsapp" size={17} color="#16A34A" />
                <Text style={[styles.secondaryText, { color: '#16A34A' }]}>WhatsApp</Text>
              </Pressable>
            </View>
          ) : null}
          {order.notes ? <Text style={[styles.note, { color: colors.text, backgroundColor: colors.background }]}>«{order.notes}»</Text> : null}
        </View>

        {/* Artículos */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Head title={`Artículos (${order.order_items.length})`} icon="cube-outline" colors={colors} />
          {order.order_items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={[styles.qty, { color: colors.muted }]}>{item.quantity}×</Text>
              <View style={styles.flex}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.product_name}</Text>
                {(item.variant_name || item.product_sku) && <Text style={[styles.small, { color: colors.muted }]}>{[item.variant_name, item.product_sku].filter(Boolean).join(' · ')}</Text>}
              </View>
              <Text style={[styles.itemTotal, { color: colors.text }]}>{formatGs(item.subtotal)}</Text>
            </View>
          ))}
          <View style={[styles.totals, { borderColor: colors.border }]}>
            <Line label="Subtotal" value={formatGs(order.subtotal)} colors={colors} />
            {order.shipping_cost > 0 && <Line label="Envío" value={formatGs(order.shipping_cost)} colors={colors} />}
            {order.discount_amount > 0 && <Line label="Descuento" value={`− ${formatGs(order.discount_amount)}`} colors={colors} tone={palette.danger} />}
            <Line label="Total" value={formatGs(order.total)} colors={colors} big />
          </View>
        </View>

        {/* Pago */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Head title="Pago" icon="cash-outline" colors={colors} />
          <View style={styles.rowBetween}>
            <Text style={[styles.badgeText, { color: payment.color }]}>{payment.label}</Text>
            <Text style={[styles.small, { color: colors.muted }]}>Método: {order.payment_method}</Text>
          </View>
          {order.collected_amount > 0 && <Line label="Cobrado" value={formatGs(order.collected_amount)} colors={colors} />}
          {order.amount_due > 0 && <Line label="Falta cobrar" value={formatGs(order.amount_due)} colors={colors} tone={palette.danger} />}
          {order.amount_due > 0 && order.status !== 'CANCELLED' && (
            <Pressable onPress={() => setPayOpen(true)} style={[styles.primary, { backgroundColor: '#16A34A' }]}>
              <Ionicons name="cash-outline" size={18} color="#fff" />
              <Text style={styles.primaryText}>Registrar cobro</Text>
            </Pressable>
          )}
        </View>

        {/* Historial */}
        {history.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Head title="Historial" icon="time-outline" colors={colors} />
            {[...history].reverse().map((event) => (
              <View key={event.id} style={styles.event}>
                <Ionicons name={event.kind === 'PAYMENT' ? 'cash-outline' : 'swap-horizontal-outline'} size={15} color={colors.muted} />
                <View style={styles.flex}>
                  <Text style={[styles.eventText, { color: colors.text }]}>
                    {event.kind === 'PAYMENT'
                      ? `Cobro${event.amount ? ` de ${formatGs(event.amount)}` : ''} · ${PAYMENT_LABEL[event.to]?.label ?? event.to}`
                      : ORDER_STATUS[event.to as OrderStatus]?.label ?? event.to}
                  </Text>
                  <Text style={[styles.small, { color: colors.muted }]}>
                    {when(event.createdAt)} · {event.actor ?? 'Sistema'}
                    {event.note ? ` · «${event.note}»` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {payOpen && <CollectSheet order={order} onClose={() => setPayOpen(false)} onDone={(updated) => { setPayOpen(false); apply(updated, 'Cobro registrado.'); }} />}
    </View>
  );
}

function Head({ title, icon, colors }: { title: string; icon: keyof typeof Ionicons.glyphMap; colors: Colors }) {
  return (
    <View style={styles.head}>
      <Ionicons name={icon} size={16} color={palette.primary} />
      <Text style={[styles.headText, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

function Line({ label, value, colors, tone, big }: { label: string; value: string; colors: Colors; tone?: string; big?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[big ? styles.bigLabel : styles.small, { color: big ? colors.text : colors.muted }]}>{label}</Text>
      <Text style={[big ? styles.bigValue : styles.lineValue, { color: tone ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function CollectSheet({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: (order: Order) => void }) {
  const colors = usePalette();
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [amount, setAmount] = useState(pretty(order.amount_due));
  const [reference, setReference] = useState('');
  const [key] = useState(uuid);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = digits(amount);
  const problem = value <= 0 ? 'Escribí el monto.' : value > order.amount_due ? `El saldo es ${formatGs(order.amount_due)}.` : method !== 'CASH' && !reference.trim() ? 'Anotá la referencia o el comprobante.' : null;

  const save = async () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const updated = await collectOrderPayment(order.id, { amount: value, method, reference }, key);
      onDone(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cobrar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      title="Registrar cobro"
      subtitle={`Pedido #${order.order_number} · falta ${formatGs(order.amount_due)}`}
      onClose={() => !saving && onClose()}
      footer={
        <Pressable onPress={save} disabled={saving} style={[styles.primary, { backgroundColor: '#16A34A', opacity: saving || problem ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Cobrar {formatGs(value)}</Text>}
        </Pressable>
      }>
      <View style={styles.methods}>
        {(['CASH', 'CARD', 'TRANSFER'] as const).map((item) => (
          <Pressable key={item} onPress={() => setMethod(item)} style={[styles.method, { borderColor: method === item ? palette.primary : colors.border, backgroundColor: method === item ? 'rgba(37,99,235,0.08)' : colors.background }]}>
            <Ionicons name={item === 'CASH' ? 'cash-outline' : item === 'CARD' ? 'card-outline' : 'swap-horizontal-outline'} size={20} color={method === item ? palette.primary : colors.muted} />
            <Text style={[styles.secondaryText, { color: method === item ? palette.primary : colors.text }]}>{item === 'CASH' ? 'Efectivo' : item === 'CARD' ? 'Tarjeta' : 'Transferencia'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.small, { color: colors.muted }]}>Gs.</Text>
        <TextInput value={amount} onChangeText={(next) => setAmount(pretty(next))} keyboardType="number-pad" style={[styles.input, { color: colors.text }]} />
      </View>
      {method !== 'CASH' && (
        <TextInput value={reference} onChangeText={setReference} placeholder="Referencia o comprobante" placeholderTextColor={colors.muted} style={[styles.inputBox, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 13, textAlign: 'center' },
  small: { fontSize: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 13, fontWeight: '800' },
  timeline: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 5 },
  stepDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 9, fontWeight: '700' },
  actions: { gap: 8 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, minHeight: 50 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondary: { borderWidth: 1, borderRadius: 14, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headText: { fontSize: 15, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '800' },
  address: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  contactRow: { flexDirection: 'row', gap: 10 },
  contact: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
  note: { borderRadius: 10, padding: 10, fontSize: 13, fontStyle: 'italic' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qty: { fontSize: 14, fontWeight: '800', minWidth: 28 },
  itemName: { fontSize: 14, fontWeight: '700' },
  itemTotal: { fontSize: 14, fontWeight: '800' },
  totals: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  lineValue: { fontSize: 13, fontWeight: '700' },
  bigLabel: { fontSize: 16, fontWeight: '800' },
  bigValue: { fontSize: 20, fontWeight: '900' },
  event: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eventText: { fontSize: 14, fontWeight: '700' },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 18, fontWeight: '800', paddingVertical: 12 },
  inputBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
});
