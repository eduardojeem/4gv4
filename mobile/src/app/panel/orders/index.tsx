import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { fetchOrders, onOrderChanged, ORDER_STATUS, PAYMENT_LABEL, rememberOrders, type Order, type OrderStatus } from '@/lib/pos';

type Colors = ReturnType<typeof usePalette>;
type Filter = OrderStatus | 'ALL';

const FILTERS: Filter[] = ['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

/** Pedidos de la tienda online, como /dashboard/orders: por estado, con búsqueda y totales del día. */
export default function OrdersScreen() {
  const colors = usePalette();
  const { data: panelData, findItem, loading: panelLoading } = usePanel();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [meta, setMeta] = useState<{ todayCount: number; todayRevenue: number } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const requestScope = useListRequestScope(JSON.stringify([panelData?.organization.id, panelData?.organization.role, panelData?.user.email,search,filter,attempt]));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    if (!panelData || !findItem('orders')) return () => { active = false; };
    queueMicrotask(() => { if (active) { setLoading(true); setLoadingMore(false); } });
    fetchOrders({ status: filter, search, page: 1, withStats: true })
      .then((data) => {
        if (!active) return;
        rememberOrders(data.orders);
        setOrders(data.orders);
        setStats(data.stats);
        setMeta(data.meta);
        setPage(1);
        setTotalPages(data.pagination.totalPages);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos.'))
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [filter, search, attempt, panelData, findItem]);

  useEffect(() => onOrderChanged((changed) => setOrders((list) => list.map((order) => (order.id === changed.id ? changed : order)))), []);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    const isCurrent = requestScope.capture();
    setLoadingMore(true);
    fetchOrders({ status: filter, search, page: page + 1 })
      .then((data) => {
        if (!isCurrent()) return;
        setError(null);
        rememberOrders(data.orders);
        setOrders((list) => [...list, ...data.orders.filter((order) => !list.some((item) => item.id === order.id))]);
        setPage(page + 1);
      })
      .catch((err) => { if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.'); })
      .finally(() => { if (isCurrent()) setLoadingMore(false); });
  };

  if (panelLoading || !findItem('orders')) return <PanelAccessState />;

  const pending = (stats?.PENDING ?? 0) + (stats?.CONFIRMED ?? 0) + (stats?.PREPARING ?? 0) + (stats?.READY ?? 0);

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Pedidos</Text>
          <View style={styles.kpis}>
            <Kpi label="Hoy" value={String(meta?.todayCount ?? 0)} colors={colors} />
            <Kpi label="Cobrado hoy" value={formatGs(meta?.todayRevenue ?? 0)} colors={colors} />
            <Kpi label="Por atender" value={String(pending)} colors={colors} tone={pending > 0 ? '#D97706' : undefined} />
          </View>
          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={17} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="N.º de pedido, cliente o teléfono" placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((key) => {
              const selected = filter === key;
              const config = key === 'ALL' ? { label: 'Todos', color: palette.primary } : ORDER_STATUS[key];
              const count = key === 'ALL' ? null : stats?.[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setFilter(key);
                  }}
                  style={[styles.chip, { borderColor: selected ? config.color : colors.border, backgroundColor: selected ? `${config.color}18` : colors.card }]}>
                  <Text style={[styles.chipText, { color: selected ? config.color : colors.text }]}>{config.label}</Text>
                  {count ? (
                    <View style={[styles.count, { backgroundColor: config.color }]}>
                      <Text style={styles.countText}>{count}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {error && orders.length > 0 && <Text style={styles.error}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={styles.loading} color={palette.primary} />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={36} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{error ?? (search ? 'Sin resultados' : 'No hay pedidos')}</Text>
            {error ? (
              <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
              </Pressable>
            ) : (
              <Text style={[styles.muted, { color: colors.muted }]}>Los pedidos de tu tienda online aparecen acá.</Text>
            )}
          </View>
        )
      }
      ListFooterComponent={<View>{error && <Text accessibilityRole="alert" style={{ color: palette.danger, padding: 12 }}>{error}</Text>}{loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}</View>}
      renderItem={({ item }) => <OrderCard order={item} colors={colors} />}
    />
  );
}

function Kpi({ label, value, colors, tone }: { label: string; value: string; colors: Colors; tone?: string }) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: tone ?? colors.text }]}>{value}</Text>
      <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function OrderCard({ order, colors }: { order: Order; colors: Colors }) {
  const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.PENDING;
  const payment = PAYMENT_LABEL[String(order.payment_status).toUpperCase()] ?? PAYMENT_LABEL.PENDING;
  const items = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Pressable
      onPress={() => router.push(`/panel/orders/${order.id}` as never)}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.stripe, { backgroundColor: status.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <Text style={[styles.number, { color: colors.text }]}>#{order.order_number}</Text>
          <View style={[styles.badge, { backgroundColor: `${status.color}1A` }]}>
            <Ionicons name={status.icon as keyof typeof Ionicons.glyphMap} size={12} color={status.color} />
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.customer, { color: colors.text }]}>{order.customer_name || 'Cliente'}</Text>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
          {items} {items === 1 ? 'artículo' : 'artículos'} · {order.fulfillment_type === 'DELIVERY' ? 'Envío' : 'Retiro en local'} · {ago(order.created_at)}
        </Text>
        <View style={styles.rowBetween}>
          <Text style={[styles.small, { color: payment.color, fontWeight: '800' }]}>{payment.label}</Text>
          <Text style={[styles.total, { color: colors.text }]}>{formatGs(order.total)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  header: { gap: 12 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13, textAlign: 'center' },
  small: { fontSize: 12 },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 10 },
  kpiValue: { fontSize: 17, fontWeight: '900' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  count: { borderRadius: 999, minWidth: 18, height: 18, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  loading: { paddingVertical: 40 },
  more: { paddingVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  stripe: { width: 4 },
  cardBody: { flex: 1, padding: 12, gap: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { fontSize: 15, fontWeight: '900' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  customer: { fontSize: 15, fontWeight: '700' },
  total: { fontSize: 16, fontWeight: '900' },
});
