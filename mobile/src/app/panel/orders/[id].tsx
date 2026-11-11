import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PanelAccessState } from '@/components/panel-access-state';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { usePaymentControls } from '@/lib/payment-controls';
import {
  buildOrderWhatsAppUrl,
  cachedOrder,
  changeOrderStatus,
  collectOrderPayment,
  fetchOrder,
  fetchOrderBranches,
  fetchOrderHistory,
  nextOrderStatus,
  notifyOrder,
  ORDER_FLOW,
  ORDER_STATUS,
  orderSummaryText,
  PAYMENT_LABEL,
  PAYMENT_METHOD_LABELS,
  stripDuplicateVariantSuffix,
  updateOrder,
  uuid,
  type Order,
  type OrderBranch,
  type OrderEvent,
  type OrderFulfillmentType,
  type OrderPaymentMethod,
  type OrderStatus,
} from '@/lib/pos';

type Colors = ReturnType<typeof usePalette>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};
const when = (iso: string) => new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Confirmar pedido',
  PREPARING: 'Empezar a preparar',
  READY: 'Marcar listo',
  SHIPPED: 'Marcar enviado',
  DELIVERED: 'Marcar entregado',
};

const PAYMENT_OPTIONS: {
  key: OrderPaymentMethod;
  controlId: 'cash' | 'card' | 'transfer' | 'digital_wallet';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'CASH', controlId: 'cash', label: 'Efectivo', icon: 'cash-outline' },
  { key: 'CARD', controlId: 'card', label: 'Tarjeta', icon: 'card-outline' },
  { key: 'TRANSFER', controlId: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline' },
  { key: 'DIGITAL_WALLET', controlId: 'digital_wallet', label: 'Billetera', icon: 'wallet-outline' },
];

const CANCEL_REASON_PRESETS = [
  'Sin stock disponible',
  'Solicitado por el cliente',
  'Datos de contacto incompletos',
  'Fuera de zona de cobertura',
];

export default function OrderDetail() {
  const colors = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: panel, findItem, can, loading: panelLoading } = usePanel();
  const hasAccess = Boolean(!panelLoading && panel && findItem('orders') && can('ecommerce.orders.manage'));
  const deliveryAllowed = can('orders.delivery');

  const [order, setOrder] = useState<Order | undefined>(() => (id ? cachedOrder(id) : undefined));
  const [history, setHistory] = useState<OrderEvent[]>([]);
  const [branches, setBranches] = useState<OrderBranch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id || !hasAccess) return;
    let active = true;
    Promise.all([fetchOrder(id), fetchOrderHistory(id).catch(() => [])])
      .then(([fresh, events]) => {
        if (!active) return;
        setOrder(fresh);
        setHistory(events);
        notifyOrder(fresh);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo cargar el pedido.'));
    return () => {
      active = false;
    };
  }, [id, attempt, hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    let active = true;
    fetchOrderBranches()
      .then((list) => {
        if (active) setBranches(list);
      })
      .catch(() => {
        if (active) setBranches([]);
      });
    return () => {
      active = false;
    };
  }, [hasAccess, panel?.organization.id]);

  if (panelLoading || !findItem('orders') || !can('ecommerce.orders.manage')) {
    return <PanelAccessState />;
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/panel/orders' as never));

  if (!order) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={[styles.muted, { color: colors.muted }]}>{error}</Text>
            <Pressable onPress={() => setAttempt((n) => n + 1)} style={[styles.retryBtn, { borderColor: colors.border }]}>
              <Text style={[styles.secondaryText, { color: colors.text }]}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={palette.primary} />
        )}
      </View>
    );
  }

  const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.PENDING;
  const payment = PAYMENT_LABEL[String(order.payment_status).toUpperCase()] ?? PAYMENT_LABEL.PENDING;
  const next = nextOrderStatus(order);
  const closed = order.status === 'DELIVERED' || order.status === 'CANCELLED';
  const step = ORDER_FLOW.indexOf(order.status);
  const flow = order.fulfillment_type === 'PICKUP' ? ORDER_FLOW.filter((s) => s !== 'SHIPPED') : ORDER_FLOW;
  const branchName = order.branch_id ? branches.find((b) => b.id === order.branch_id)?.name ?? null : null;
  const isPanelOrder = order.channel === 'PANEL';
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method;

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
      return true;
    } catch (err) {
      Alert.alert('No se pudo cambiar el estado', err instanceof Error ? err.message : 'Probá de nuevo.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = () => {
    if (!next) return;
    if (next === 'DELIVERED') {
      const msg = order.amount_due > 0
        ? `Este pedido todavía tiene un saldo pendiente de ${formatGs(order.amount_due)}. ¿Querés marcarlo como entregado igualmente?`
        : `¿Confirmás que el pedido #${order.order_number} ya fue entregado?`;
      Alert.alert('Confirmar entrega', msg, [
        { text: 'Volver', style: 'cancel' },
        { text: 'Confirmar entrega', onPress: () => void move('DELIVERED') },
      ]);
      return;
    }
    void move(next);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: orderSummaryText(order, branchName),
      });
    } catch {
      // Cancelado por el usuario o sin soporte
    }
  };

  const whatsapp = () => {
    const url = buildOrderWhatsAppUrl(order, panel?.organization.slug);
    if (!url) return;
    void Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp no disponible', 'No se pudo abrir WhatsApp en este dispositivo.');
    });
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={back} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.topTitle, styles.flex, { color: colors.text }]}>
          Pedido #{order.order_number}
        </Text>
        <Pressable onPress={() => void handleShare()} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Compartir resumen">
          <Ionicons name="share-outline" size={21} color={colors.text} />
        </Pressable>
        {order.status !== 'CANCELLED' && (
          <Pressable onPress={() => setEditOpen(true)} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Editar pedido">
            <Ionicons name="create-outline" size={21} color={palette.primary} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {notice && (
          <View style={[styles.notice, { borderColor: '#16A34A55', backgroundColor: '#16A34A12' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.noticeText, { color: '#16A34A' }]}>{notice}</Text>
          </View>
        )}

        {/* Estado y origen */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <View style={[styles.badge, { backgroundColor: `${status.color}1A` }]}>
              <Ionicons name={status.icon as keyof typeof Ionicons.glyphMap} size={14} color={status.color} />
              <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
            <Text style={[styles.small, { color: colors.muted }]}>{when(order.created_at)}</Text>
          </View>

          <View style={styles.metaPills}>
            <View style={[styles.metaPill, { borderColor: isPanelOrder ? '#4F46E544' : colors.border, backgroundColor: isPanelOrder ? '#4F46E512' : colors.background }]}>
              <Ionicons name={isPanelOrder ? 'storefront-outline' : 'globe-outline'} size={12} color={isPanelOrder ? '#4F46E5' : colors.muted} />
              <Text style={[styles.metaPillText, { color: isPanelOrder ? '#4F46E5' : colors.muted }]}>
                {isPanelOrder ? 'Cargado en Panel' : 'Tienda Web'}
              </Text>
            </View>
            {branchName && (
              <View style={[styles.metaPill, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="business-outline" size={12} color={colors.muted} />
                <Text style={[styles.metaPillText, { color: colors.muted }]}>{branchName}</Text>
              </View>
            )}
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
                <Pressable onPress={handleAdvance} disabled={busy} style={[styles.primary, { backgroundColor: ORDER_STATUS[next].color, opacity: busy ? 0.6 : 1 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name={ORDER_STATUS[next].icon as keyof typeof Ionicons.glyphMap} size={18} color="#fff" />}
                  <Text style={styles.primaryText}>{NEXT_ACTION[next] ?? `Pasar a ${ORDER_STATUS[next].label}`}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setCancelOpen(true)} disabled={busy} style={[styles.secondary, { borderColor: '#DC262655' }]}>
                <Text style={[styles.secondaryText, { color: palette.danger }]}>Cancelar pedido</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Cliente */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <Head title="Cliente" icon="person-outline" colors={colors} />
            {order.status !== 'CANCELLED' && (
              <Pressable onPress={() => setEditOpen(true)} hitSlop={6}>
                <Text style={[styles.small, { color: palette.primary, fontWeight: '700' }]}>Editar</Text>
              </Pressable>
            )}
          </View>
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
          {order.order_items.map((item) => {
            const cleanName = stripDuplicateVariantSuffix(item.product_name, item.variant_name);
            return (
              <View key={item.id} style={styles.item}>
                <Text style={[styles.qty, { color: colors.muted }]}>{item.quantity}×</Text>
                <View style={styles.flex}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{cleanName}</Text>
                  {(item.variant_name || item.product_sku) && (
                    <Text style={[styles.small, { color: colors.muted }]}>{[item.variant_name, item.product_sku].filter(Boolean).join(' · ')}</Text>
                  )}
                </View>
                <Text style={[styles.itemTotal, { color: colors.text }]}>{formatGs(item.subtotal)}</Text>
              </View>
            );
          })}
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
            <Text style={[styles.small, { color: colors.muted }]}>Método: {paymentMethodLabel}</Text>
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
            {[...history].reverse().map((event) => {
              const eventMethod = event.paymentMethod ? PAYMENT_METHOD_LABELS[event.paymentMethod] ?? event.paymentMethod : null;
              return (
                <View key={event.id} style={styles.event}>
                  <Ionicons name={event.kind === 'PAYMENT' ? 'cash-outline' : 'swap-horizontal-outline'} size={15} color={colors.muted} />
                  <View style={styles.flex}>
                    <Text style={[styles.eventText, { color: colors.text }]}>
                      {event.kind === 'PAYMENT'
                        ? `Cobro${event.amount ? ` de ${formatGs(event.amount)}` : ''} · ${PAYMENT_LABEL[event.to]?.label ?? event.to}${eventMethod ? ` (${eventMethod})` : ''}`
                        : ORDER_STATUS[event.to as OrderStatus]?.label ?? event.to}
                    </Text>
                    <Text style={[styles.small, { color: colors.muted }]}>
                      {when(event.createdAt)} · {event.actor ?? 'Sistema'}
                      {event.paymentReference ? ` · Ref. ${event.paymentReference}` : ''}
                      {event.note ? ` · «${event.note}»` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {payOpen && (
        <CollectSheet
          order={order}
          onClose={() => setPayOpen(false)}
          onDone={(updated) => {
            setPayOpen(false);
            apply(updated, 'Cobro registrado.');
          }}
        />
      )}

      {editOpen && (
        <EditOrderSheet
          order={order}
          deliveryAllowed={deliveryAllowed}
          onClose={() => setEditOpen(false)}
          onDone={(updated) => {
            setEditOpen(false);
            apply(updated, 'Pedido actualizado.');
          }}
        />
      )}

      {cancelOpen && (
        <CancelOrderSheet
          order={order}
          busy={busy}
          onClose={() => setCancelOpen(false)}
          onConfirm={async (note) => {
            const ok = await move('CANCELLED', note);
            if (ok) setCancelOpen(false);
          }}
        />
      )}
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
  const paymentControls = usePaymentControls(true);
  const initialMethod: OrderPaymentMethod =
    PAYMENT_OPTIONS.some((opt) => opt.key === order.payment_method)
      ? (order.payment_method as OrderPaymentMethod)
      : 'CASH';
  const [method, setMethod] = useState<OrderPaymentMethod>(initialMethod);
  const [amount, setAmount] = useState(pretty(order.amount_due));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [key] = useState(uuid);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedOptions = paymentControls.ready
    ? PAYMENT_OPTIONS.filter((opt) => paymentControls.allows(opt.controlId))
    : [];
  const resolvedMethod: OrderPaymentMethod | null = allowedOptions.some((opt) => opt.key === method)
    ? method
    : (allowedOptions[0]?.key ?? null);

  const value = digits(amount);
  const problem = !paymentControls.ready
    ? paymentControls.error || 'Cargando medios de cobro habilitados…'
    : !resolvedMethod
      ? 'Este comercio no tiene medios de cobro habilitados.'
      : value <= 0
        ? 'Escribí el monto.'
        : value > order.amount_due
          ? `El saldo es ${formatGs(order.amount_due)}.`
          : resolvedMethod !== 'CASH' && !reference.trim()
            ? 'Anotá la referencia o el comprobante.'
            : null;

  const save = async () => {
    if (problem || !resolvedMethod) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const updated = await collectOrderPayment(
        order.id,
        { amount: value, method: resolvedMethod, reference, note: note.trim() || undefined },
        key
      );
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
        <Pressable onPress={save} disabled={saving || Boolean(problem)} style={[styles.primary, { backgroundColor: '#16A34A', opacity: saving || problem ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Cobrar {formatGs(value)}</Text>}
        </Pressable>
      }>
      {!paymentControls.ready ? (
        paymentControls.error ? (
          <View style={styles.inlineBox}>
            <Text style={styles.error}>{paymentControls.error}</Text>
            <Pressable onPress={paymentControls.retry} style={[styles.retryBtn, { borderColor: colors.border }]}>
              <Text style={[styles.secondaryText, { color: colors.text }]}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.inlineBox}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.small, { color: colors.muted }]}>Cargando medios de cobro habilitados…</Text>
          </View>
        )
      ) : allowedOptions.length === 0 ? (
        <Text style={styles.error}>No hay medios de cobro activos configurados para este comercio.</Text>
      ) : (
        <View style={styles.methodsGrid}>
          {allowedOptions.map((item) => {
            const selected = resolvedMethod === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setMethod(item.key)}
                style={[styles.methodHalf, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.background }]}>
                <Ionicons name={item.icon} size={19} color={selected ? palette.primary : colors.muted} />
                <Text style={[styles.secondaryText, { color: selected ? palette.primary : colors.text }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.small, { color: colors.muted }]}>Gs.</Text>
        <TextInput value={amount} onChangeText={(next) => setAmount(pretty(next))} keyboardType="number-pad" style={[styles.input, { color: colors.text }]} />
      </View>
      {resolvedMethod && resolvedMethod !== 'CASH' && (
        <TextInput
          value={reference}
          onChangeText={setReference}
          placeholder="Referencia o comprobante"
          placeholderTextColor={colors.muted}
          maxLength={160}
          style={[styles.inputBox, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        />
      )}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Nota interna (opcional)"
        placeholderTextColor={colors.muted}
        maxLength={1000}
        style={[styles.inputBox, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function CancelOrderSheet({
  order,
  busy,
  onClose,
  onConfirm,
}: {
  order: Order;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => Promise<void>;
}) {
  const colors = usePalette();
  const [note, setNote] = useState('');

  return (
    <BottomSheet
      visible
      title={`Cancelar pedido #${order.order_number}`}
      subtitle="Se revertirán las reservas de stock y crédito en tienda de forma atómica."
      onClose={() => !busy && onClose()}
      footer={
        <Pressable
          onPress={() => void onConfirm(note.trim() || undefined)}
          disabled={busy}
          style={[styles.primary, { backgroundColor: palette.danger, opacity: busy ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Confirmar cancelación</Text>}
        </Pressable>
      }>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Motivo rápido (opcional)</Text>
      <View style={styles.reasonGrid}>
        {CANCEL_REASON_PRESETS.map((reason) => {
          const selected = note === reason;
          return (
            <Pressable
              key={reason}
              onPress={() => setNote(selected ? '' : reason)}
              style={[
                styles.reasonChip,
                {
                  borderColor: selected ? palette.danger : colors.border,
                  backgroundColor: selected ? '#DC262614' : colors.background,
                },
              ]}>
              <Text style={[styles.small, { color: selected ? palette.danger : colors.text, fontWeight: '700' }]}>{reason}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Detalle adicional (se guarda en el historial)</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Escribí un motivo o aclaración…"
        placeholderTextColor={colors.muted}
        multiline
        numberOfLines={3}
        maxLength={1000}
        style={[styles.inputBox, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
    </BottomSheet>
  );
}

function EditOrderSheet({
  order,
  deliveryAllowed,
  onClose,
  onDone,
}: {
  order: Order;
  deliveryAllowed: boolean;
  onClose: () => void;
  onDone: (order: Order) => void;
}) {
  const colors = usePalette();
  const paymentControls = usePaymentControls(true);
  const financialLocked = order.payment_status !== 'PENDING' || order.status === 'DELIVERED' || order.status === 'CANCELLED';
  const shippingLocksPickup = financialLocked && order.shipping_cost > 0;

  const initialMethod: OrderPaymentMethod =
    PAYMENT_OPTIONS.some((opt) => opt.key === order.payment_method)
      ? (order.payment_method as OrderPaymentMethod)
      : 'CASH';

  const [customerName, setCustomerName] = useState(order.customer_name);
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone ?? '');
  const [customerEmail, setCustomerEmail] = useState(order.customer_email ?? '');
  const [customerAddress, setCustomerAddress] = useState(order.customer_address ?? '');
  const [fulfillmentType, setFulfillmentType] = useState<OrderFulfillmentType>(order.fulfillment_type);
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>(initialMethod);
  const [shippingInput, setShippingInput] = useState(pretty(order.shipping_cost || 0));
  const [discountInput, setDiscountInput] = useState(pretty(order.discount_amount || 0));
  const [notes, setNotes] = useState(order.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedOptions = paymentControls.ready
    ? PAYMENT_OPTIONS.filter((opt) => paymentControls.allows(opt.controlId))
    : [];
  const currentMethodAllowed = paymentControls.ready && allowedOptions.some((opt) => opt.key === paymentMethod);

  const shippingCost = financialLocked
    ? order.shipping_cost
    : fulfillmentType === 'PICKUP'
      ? 0
      : digits(shippingInput);
  const discountAmount = financialLocked ? order.discount_amount : digits(discountInput);
  const previewTotal = Math.max(0, order.subtotal + shippingCost - discountAmount);

  const problem = !customerName.trim()
    ? 'El nombre del cliente es obligatorio.'
    : customerEmail.trim() && !EMAIL_RE.test(customerEmail.trim())
      ? 'El email no es válido.'
      : fulfillmentType === 'DELIVERY' && !customerPhone.trim()
        ? 'Ingresá el teléfono para la entrega.'
        : fulfillmentType === 'DELIVERY' && !customerAddress.trim()
          ? 'Ingresá la dirección de entrega.'
          : shippingLocksPickup && fulfillmentType === 'PICKUP'
            ? 'No se puede cambiar a retiro porque el pedido ya tiene envío registrado y pagos o cierre.'
            : !financialLocked && discountAmount > order.subtotal
              ? 'El descuento no puede superar el subtotal.'
              : paymentControls.error
                ? paymentControls.error
                : !paymentControls.ready
                  ? 'Verificando medios de pago habilitados…'
                  : !currentMethodAllowed
                    ? 'Elegí un medio de pago habilitado para este comercio.'
                    : null;

  const save = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateOrder(order.id, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim(),
        customer_address: customerAddress.trim() || null,
        fulfillment_type: fulfillmentType,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        ...(financialLocked
          ? {}
          : {
              shipping_cost: shippingCost,
              discount_amount: discountAmount,
            }),
      });
      onDone(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      tall
      title={`Editar pedido #${order.order_number}`}
      subtitle="Actualizá datos de contacto, entrega, pago y notas."
      onClose={() => !saving && onClose()}
      footer={
        <Pressable
          onPress={() => void save()}
          disabled={saving || Boolean(problem)}
          style={[styles.primary, { backgroundColor: palette.primary, opacity: saving || problem ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Guardar cambios</Text>}
        </Pressable>
      }>
      {financialLocked && (
        <View style={[styles.lockBanner, { borderColor: '#D9770655', backgroundColor: '#D9770614' }]}>
          <Ionicons name="lock-closed-outline" size={16} color="#D97706" />
          <Text style={[styles.small, styles.flex, { color: colors.text }]}>
            Importes bloqueados porque el pedido tiene pagos registrados o está cerrado.
          </Text>
        </View>
      )}

      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Nombre *</Text>
      <TextInput
        value={customerName}
        onChangeText={setCustomerName}
        maxLength={200}
        style={[styles.inputBox, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />

      <Text style={[styles.fieldLabel, { color: colors.muted }]}>
        Teléfono {fulfillmentType === 'DELIVERY' ? '*' : '(opcional)'}
      </Text>
      <TextInput
        value={customerPhone}
        onChangeText={setCustomerPhone}
        keyboardType="phone-pad"
        maxLength={50}
        placeholder="0981 123 456"
        placeholderTextColor={colors.muted}
        style={[styles.inputBox, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />

      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Email (opcional)</Text>
      <TextInput
        value={customerEmail}
        onChangeText={setCustomerEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="cliente@correo.com"
        placeholderTextColor={colors.muted}
        style={[styles.inputBox, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />

      <Text style={[styles.fieldLabel, { color: colors.muted }]}>
        Dirección {fulfillmentType === 'DELIVERY' ? '*' : '(opcional)'}
      </Text>
      <TextInput
        value={customerAddress}
        onChangeText={setCustomerAddress}
        maxLength={500}
        placeholder="Calle, nro., referencia"
        placeholderTextColor={colors.muted}
        style={[styles.inputBox, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />

      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Modalidad de entrega</Text>
      <View style={styles.segmentRow}>
        <Pressable
          disabled={shippingLocksPickup}
          onPress={() => setFulfillmentType('PICKUP')}
          style={[
            styles.segmentBtn,
            {
              borderColor: fulfillmentType === 'PICKUP' ? palette.primary : colors.border,
              backgroundColor: fulfillmentType === 'PICKUP' ? `${palette.primary}15` : colors.background,
              opacity: shippingLocksPickup ? 0.45 : 1,
            },
          ]}>
          <Ionicons name="storefront-outline" size={16} color={fulfillmentType === 'PICKUP' ? palette.primary : colors.muted} />
          <Text style={[styles.secondaryText, { color: fulfillmentType === 'PICKUP' ? palette.primary : colors.text }]}>Retiro</Text>
        </Pressable>
        {(deliveryAllowed || order.fulfillment_type === 'DELIVERY') && (
          <Pressable
            disabled={!deliveryAllowed}
            onPress={() => setFulfillmentType('DELIVERY')}
            style={[
              styles.segmentBtn,
              {
                borderColor: fulfillmentType === 'DELIVERY' ? '#7C3AED' : colors.border,
                backgroundColor: fulfillmentType === 'DELIVERY' ? '#7C3AED18' : colors.background,
                opacity: !deliveryAllowed ? 0.45 : 1,
              },
            ]}>
            <Ionicons name="bicycle-outline" size={16} color={fulfillmentType === 'DELIVERY' ? '#7C3AED' : colors.muted} />
            <Text style={[styles.secondaryText, { color: fulfillmentType === 'DELIVERY' ? '#7C3AED' : colors.text }]}>Delivery</Text>
          </Pressable>
        )}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Medio de pago acordado</Text>
      {!paymentControls.ready ? (
        paymentControls.error ? (
          <View style={styles.inlineBox}>
            <Text style={styles.error}>{paymentControls.error}</Text>
            <Pressable onPress={paymentControls.retry} style={[styles.retryBtn, { borderColor: colors.border }]}>
              <Text style={[styles.secondaryText, { color: colors.text }]}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator size="small" color={palette.primary} />
        )
      ) : (
        <View style={styles.methodsGrid}>
          {PAYMENT_OPTIONS.filter((opt) => paymentControls.allows(opt.controlId) || opt.key === paymentMethod).map((opt) => {
            const allowed = paymentControls.allows(opt.controlId);
            const selected = paymentMethod === opt.key;
            return (
              <Pressable
                key={opt.key}
                disabled={!allowed}
                onPress={() => setPaymentMethod(opt.key)}
                style={[
                  styles.methodHalf,
                  {
                    borderColor: selected ? (allowed ? palette.primary : '#D97706') : colors.border,
                    backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.background,
                    opacity: allowed ? 1 : 0.55,
                  },
                ]}>
                <Ionicons name={opt.icon} size={18} color={selected ? palette.primary : colors.muted} />
                <Text style={[styles.secondaryText, { color: selected ? palette.primary : colors.text }]}>
                  {opt.label}{!allowed ? ' (inactivo)' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.twoCols}>
        <View style={styles.flex}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Costo de envío</Text>
          <TextInput
            editable={!financialLocked && fulfillmentType === 'DELIVERY'}
            value={financialLocked ? pretty(order.shipping_cost || 0) : fulfillmentType === 'PICKUP' ? '0' : shippingInput}
            onChangeText={(v) => setShippingInput(pretty(v))}
            keyboardType="number-pad"
            style={[
              styles.inputBox,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.background,
                opacity: financialLocked || fulfillmentType === 'PICKUP' ? 0.5 : 1,
              },
            ]}
          />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Descuento</Text>
          <TextInput
            editable={!financialLocked}
            value={financialLocked ? pretty(order.discount_amount || 0) : discountInput}
            onChangeText={(v) => setDiscountInput(pretty(v))}
            keyboardType="number-pad"
            style={[
              styles.inputBox,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.background,
                opacity: financialLocked ? 0.5 : 1,
              },
            ]}
          />
        </View>
      </View>

      <View style={[styles.rowBetween, { paddingVertical: 4 }]}>
        <Text style={[styles.small, { color: colors.muted }]}>Subtotal: {formatGs(order.subtotal)}</Text>
        <Text style={[styles.lineValue, { color: colors.text }]}>Nuevo total: {formatGs(previewTotal)}</Text>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Notas / indicaciones</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        maxLength={2000}
        placeholder="Indicaciones para preparación, horario o entrega…"
        placeholderTextColor={colors.muted}
        style={[styles.inputBox, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />

      {error ? <Text style={styles.error}>{error}</Text> : problem && paymentControls.ready && !paymentControls.error ? <Text style={styles.error}>{problem}</Text> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  muted: { fontSize: 13, textAlign: 'center' },
  small: { fontSize: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 13, fontWeight: '800' },
  metaPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  metaPillText: { fontSize: 11, fontWeight: '700' },
  timeline: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 5 },
  stepDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 9, fontWeight: '700' },
  actions: { gap: 8 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, minHeight: 50 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondary: { borderWidth: 1, borderRadius: 14, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
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
  methodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodHalf: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8 },
  inlineBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 18, fontWeight: '800', paddingVertical: 12 },
  inputBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  textArea: { minHeight: 78, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  lockBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10 },
  twoCols: { flexDirection: 'row', gap: 10 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
});
