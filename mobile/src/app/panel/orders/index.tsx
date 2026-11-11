import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  fetchOrderBranches,
  fetchOrders,
  onOrderChanged,
  onOrderCreated,
  ORDER_STATUS,
  PAYMENT_LABEL,
  rememberOrders,
  type Order,
  type OrderBranch,
  type OrderFulfillmentType,
  type OrderSortOption,
  type OrderStatus,
} from '@/lib/pos';

type Colors = ReturnType<typeof usePalette>;
type Filter = OrderStatus | 'ALL';
type PaymentFilter = 'ALL' | 'PENDING' | 'PARTIAL' | 'PAID';
type FulfillmentFilter = 'ALL' | OrderFulfillmentType;

const FILTERS: Filter[] = ['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const REFRESH_INTERVAL_MS = 30_000;

const PAYMENT_FILTERS: { key: PaymentFilter; label: string }[] = [
  { key: 'PENDING', label: 'Sin pagar' },
  { key: 'PARTIAL', label: 'Parcial' },
  { key: 'PAID', label: 'Pagado' },
];

const FULFILLMENT_FILTERS: { key: OrderFulfillmentType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'DELIVERY', label: 'Delivery', icon: 'bicycle-outline' },
  { key: 'PICKUP', label: 'Retiro', icon: 'storefront-outline' },
];

const SORT_OPTIONS: { key: OrderSortOption; label: string }[] = [
  { key: 'newest', label: 'Recientes' },
  { key: 'amount_desc', label: 'Mayor monto' },
  { key: 'oldest', label: 'Más antiguos' },
];

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

/** Pedidos de la tienda online, como /dashboard/orders: por estado, filtros y totales del día. */
export default function OrdersScreen() {
  const colors = usePalette();
  const { data: panelData, findItem, can, loading: panelLoading } = usePanel();
  const orgId = panelData?.organization.id ?? null;
  const hasAccess = Boolean(!panelLoading && panelData && findItem('orders') && can('ecommerce.orders.manage'));

  const [filter, setFilter] = useState<Filter>('ALL');
  const [branchSelection, setBranchSelection] = useState<{ orgId: string | null; branchId: string }>({
    orgId: null,
    branchId: 'ALL',
  });
  const branchFilter = branchSelection.orgId === orgId ? branchSelection.branchId : 'ALL';
  const setBranchFilter = useCallback(
    (nextBranchId: string) => {
      setBranchSelection({ orgId, branchId: nextBranchId });
    },
    [orgId]
  );

  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('ALL');
  const [sort, setSort] = useState<OrderSortOption>('newest');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const [branchesState, setBranchesState] = useState<{ orgId: string | null; list: OrderBranch[] }>({
    orgId: null,
    list: [],
  });
  const branches = useMemo(
    () => (hasAccess && branchesState.orgId === orgId ? branchesState.list : []),
    [hasAccess, branchesState, orgId]
  );
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

  const pageRef = useRef(1);
  const initialFocusHandledRef = useRef(false);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const requestScope = useListRequestScope(
    JSON.stringify([
      orgId,
      panelData?.organization.role,
      panelData?.user.email,
      search,
      filter,
      branchFilter,
      paymentFilter,
      fulfillmentFilter,
      sort,
      attempt,
    ])
  );

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Cargar sucursales accesibles para filtro y badge de tarjeta
  useEffect(() => {
    if (!hasAccess) return undefined;
    let active = true;
    const requestedOrgId = orgId;
    fetchOrderBranches()
      .then((list) => {
        if (active) setBranchesState({ orgId: requestedOrgId, list });
      })
      .catch(() => {
        if (active) setBranchesState({ orgId: requestedOrgId, list: [] });
      });
    return () => {
      active = false;
    };
  }, [hasAccess, orgId]);

  useEffect(() => {
    let active = true;
    if (!hasAccess) return () => { active = false; };
    const isCurrent = requestScope.capture();
    queueMicrotask(() => {
      if (active && isCurrent()) {
        setLoading(true);
        setLoadingMore(false);
      }
    });
    fetchOrders({
      status: filter,
      search,
      page: 1,
      withStats: true,
      branchId: branchFilter,
      paymentStatus: paymentFilter,
      fulfillmentType: fulfillmentFilter,
      sort,
    })
      .then((data) => {
        if (!active || !isCurrent()) return;
        rememberOrders(data.orders);
        setOrders(data.orders);
        setStats(data.stats);
        setMeta(data.meta);
        setPage(1);
        setTotalPages(data.pagination.totalPages);
        setError(null);
      })
      .catch((err) => {
        if (active && isCurrent()) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos.');
        }
      })
      .finally(() => {
        if (active && isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [filter, search, branchFilter, paymentFilter, fulfillmentFilter, sort, attempt, hasAccess, requestScope]);

  const silentRefresh = useCallback(() => {
    if (!hasAccess) return;
    const isCurrent = requestScope.capture();
    fetchOrders({
      status: filter,
      search,
      page: 1,
      withStats: true,
      branchId: branchFilter,
      paymentStatus: paymentFilter,
      fulfillmentType: fulfillmentFilter,
      sort,
    })
      .then((data) => {
        if (!isCurrent()) return;
        rememberOrders(data.orders);
        setStats(data.stats);
        setMeta(data.meta);
        setTotalPages(data.pagination.totalPages);
        setError(null);
        setOrders((prev) => {
          if (pageRef.current <= 1) return data.orders;
          const freshById = new Map(data.orders.map((row) => [row.id, row]));
          const updatedPrev = prev.map((item) => freshById.get(item.id) ?? item);
          const unseen = data.orders.filter((item) => !prev.some((existing) => existing.id === item.id));
          return [...unseen, ...updatedPrev];
        });
      })
      .catch(() => {
        // Silencioso: no pisamos datos en pantalla por fallos transitorios en segundo plano.
      });
  }, [hasAccess, requestScope, filter, search, branchFilter, paymentFilter, fulfillmentFilter, sort]);

  // Al volver de [id] o new, actualizar silenciosamente y refrescar cada 30s mientras esté enfocada
  useFocusEffect(
    useCallback(() => {
      if (!hasAccess) return undefined;
      if (initialFocusHandledRef.current) {
        silentRefresh();
      } else {
        initialFocusHandledRef.current = true;
      }
      const interval = setInterval(() => {
        silentRefresh();
      }, REFRESH_INTERVAL_MS);
      return () => {
        clearInterval(interval);
      };
    }, [hasAccess, silentRefresh])
  );

  useEffect(() => onOrderChanged((changed) => setOrders((list) => list.map((order) => (order.id === changed.id ? changed : order)))), []);
  useEffect(() => onOrderCreated((created) => {
    setOrders((list) => {
      const matchesFilter = filter === 'ALL' || filter === created.status;
      if (!matchesFilter || list.some((order) => order.id === created.id)) return list;
      return [created, ...list];
    });
    setAttempt((n) => n + 1);
  }), [filter]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    const isCurrent = requestScope.capture();
    setLoadingMore(true);
    fetchOrders({
      status: filter,
      search,
      page: page + 1,
      branchId: branchFilter,
      paymentStatus: paymentFilter,
      fulfillmentType: fulfillmentFilter,
      sort,
    })
      .then((data) => {
        if (!isCurrent()) return;
        setError(null);
        rememberOrders(data.orders);
        setOrders((list) => [...list, ...data.orders.filter((order) => !list.some((item) => item.id === order.id))]);
        setPage(page + 1);
      })
      .catch((err) => {
        if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.');
      })
      .finally(() => {
        if (isCurrent()) setLoadingMore(false);
      });
  };

  const branchNamesById = useMemo(
    () => Object.fromEntries(branches.map((branch) => [branch.id, branch.name])),
    [branches]
  );

  const hasActiveFilters =
    filter !== 'ALL'
    || search.trim() !== ''
    || branchFilter !== 'ALL'
    || paymentFilter !== 'ALL'
    || fulfillmentFilter !== 'ALL';

  const resetFilters = () => {
    setFilter('ALL');
    setBranchFilter('ALL');
    setPaymentFilter('ALL');
    setFulfillmentFilter('ALL');
    setQuery('');
    setSearch('');
  };

  const cycleSort = () => {
    const idx = SORT_OPTIONS.findIndex((item) => item.key === sort);
    const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
    setSort(next.key);
  };

  if (panelLoading || !findItem('orders') || !can('ecommerce.orders.manage')) return <PanelAccessState />;

  // Alineado con la web ("Requieren acción" = PENDING + READY)
  const pending = (stats?.PENDING ?? 0) + (stats?.READY ?? 0);
  const currentSortLabel = SORT_OPTIONS.find((item) => item.key === sort)?.label ?? 'Recientes';

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
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>Pedidos</Text>
            <Pressable
              onPress={() => router.push('/panel/orders/new' as never)}
              accessibilityRole="button"
              accessibilityLabel="Nuevo pedido"
              style={({ pressed }) => [styles.newBtn, { opacity: pressed ? 0.85 : 1 }]}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.newBtnText}>Nuevo pedido</Text>
            </Pressable>
          </View>

          <View style={styles.kpis}>
            <Kpi label="Hoy" value={String(meta?.todayCount ?? 0)} colors={colors} />
            <Kpi label="Cobrado hoy" value={formatGs(meta?.todayRevenue ?? 0)} colors={colors} />
            <Kpi label="Por atender" value={String(pending)} colors={colors} tone={pending > 0 ? '#D97706' : undefined} />
          </View>

          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={17} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="N.º de pedido, cliente o teléfono"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Limpiar búsqueda">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Estados */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((key) => {
              const selected = filter === key;
              const config = key === 'ALL' ? { label: 'Todos', color: palette.primary } : ORDER_STATUS[key];
              const count = key === 'ALL' ? null : stats?.[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
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

          {/* Sucursales (solo multi-sucursal) */}
          {branches.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Pressable
                onPress={() => setBranchFilter('ALL')}
                style={[
                  styles.smallChip,
                  {
                    borderColor: branchFilter === 'ALL' ? palette.primary : colors.border,
                    backgroundColor: branchFilter === 'ALL' ? `${palette.primary}15` : colors.card,
                  },
                ]}>
                <Ionicons name="business-outline" size={13} color={branchFilter === 'ALL' ? palette.primary : colors.muted} />
                <Text style={[styles.smallChipText, { color: branchFilter === 'ALL' ? palette.primary : colors.text }]}>Todas las sucursales</Text>
              </Pressable>
              {branches.map((branch) => {
                const selected = branchFilter === branch.id;
                return (
                  <Pressable
                    key={branch.id}
                    onPress={() => setBranchFilter(selected ? 'ALL' : branch.id)}
                    style={[
                      styles.smallChip,
                      {
                        borderColor: selected ? palette.primary : colors.border,
                        backgroundColor: selected ? `${palette.primary}15` : colors.card,
                      },
                    ]}>
                    <Text style={[styles.smallChipText, { color: selected ? palette.primary : colors.text }]}>{branch.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Pago, entrega, orden y limpiar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable
              onPress={cycleSort}
              style={[styles.smallChip, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="swap-vertical-outline" size={13} color={palette.primary} />
              <Text style={[styles.smallChipText, { color: colors.text }]}>{currentSortLabel}</Text>
            </Pressable>

            {FULFILLMENT_FILTERS.map((item) => {
              const selected = fulfillmentFilter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFulfillmentFilter(selected ? 'ALL' : item.key)}
                  style={[
                    styles.smallChip,
                    {
                      borderColor: selected ? '#7C3AED' : colors.border,
                      backgroundColor: selected ? '#7C3AED18' : colors.card,
                    },
                  ]}>
                  <Ionicons name={item.icon} size={13} color={selected ? '#7C3AED' : colors.muted} />
                  <Text style={[styles.smallChipText, { color: selected ? '#7C3AED' : colors.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}

            {PAYMENT_FILTERS.map((item) => {
              const selected = paymentFilter === item.key;
              const tone = PAYMENT_LABEL[item.key]?.color ?? palette.primary;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setPaymentFilter(selected ? 'ALL' : item.key)}
                  style={[
                    styles.smallChip,
                    {
                      borderColor: selected ? tone : colors.border,
                      backgroundColor: selected ? `${tone}18` : colors.card,
                    },
                  ]}>
                  <Text style={[styles.smallChipText, { color: selected ? tone : colors.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}

            {hasActiveFilters && (
              <Pressable
                onPress={resetFilters}
                style={[styles.smallChip, { borderColor: `${palette.danger}55`, backgroundColor: `${palette.danger}10` }]}>
                <Ionicons name="close" size={13} color={palette.danger} />
                <Text style={[styles.smallChipText, { color: palette.danger }]}>Limpiar</Text>
              </Pressable>
            )}
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
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {error ?? (hasActiveFilters ? 'Sin resultados para estos filtros' : 'No hay pedidos')}
            </Text>
            {error ? (
              <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
              </Pressable>
            ) : hasActiveFilters ? (
              <Pressable onPress={resetFilters} style={[styles.outline, { borderColor: colors.border }]}>
                <Text style={{ color: palette.primary, fontWeight: '700' }}>Limpiar filtros</Text>
              </Pressable>
            ) : (
              <>
                <Text style={[styles.muted, { color: colors.muted }]}>Los pedidos de tu tienda y del panel aparecen acá.</Text>
                <Pressable
                  onPress={() => router.push('/panel/orders/new' as never)}
                  style={[styles.newBtn, { marginTop: 8 }]}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.newBtnText}>Nuevo pedido</Text>
                </Pressable>
              </>
            )}
          </View>
        )
      }
      ListFooterComponent={<View>{error && <Text accessibilityRole="alert" style={{ color: palette.danger, padding: 12 }}>{error}</Text>}{loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}</View>}
      renderItem={({ item }) => (
        <OrderCard
          order={item}
          branchName={branches.length > 1 && item.branch_id ? branchNamesById[item.branch_id] : undefined}
          colors={colors}
        />
      )}
    />
  );
}

function Kpi({ label, value, colors, tone }: { label: string; value: string; colors: Colors; tone?: string }) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: tone ?? colors.text }]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function OrderCard({ order, branchName, colors }: { order: Order; branchName?: string; colors: Colors }) {
  const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.PENDING;
  const payment = PAYMENT_LABEL[String(order.payment_status).toUpperCase()] ?? PAYMENT_LABEL.PENDING;
  const items = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const isPanel = order.channel === 'PANEL';
  return (
    <Pressable
      onPress={() => router.push(`/panel/orders/${order.id}` as never)}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.stripe, { backgroundColor: status.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <View style={styles.numberRow}>
            <Text style={[styles.number, { color: colors.text }]}>#{order.order_number}</Text>
            <View style={[styles.originBadge, { backgroundColor: isPanel ? '#4F46E518' : colors.background, borderColor: isPanel ? '#4F46E544' : colors.border }]}>
              <Ionicons name={isPanel ? 'storefront-outline' : 'globe-outline'} size={10} color={isPanel ? '#4F46E5' : colors.muted} />
              <Text style={[styles.originText, { color: isPanel ? '#4F46E5' : colors.muted }]}>{isPanel ? 'Panel' : 'Tienda'}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: `${status.color}1A` }]}>
            <Ionicons name={status.icon as keyof typeof Ionicons.glyphMap} size={12} color={status.color} />
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.customer, { color: colors.text }]}>{order.customer_name || 'Cliente'}</Text>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
          {items} {items === 1 ? 'artículo' : 'artículos'} · {order.fulfillment_type === 'DELIVERY' ? 'Envío' : 'Retiro en local'}
          {branchName ? ` · ${branchName}` : ''} · {ago(order.created_at)}
        </Text>
        <View style={styles.rowBetween}>
          <Text style={[styles.small, { color: payment.color, fontWeight: '800' }]}>
            {payment.label}
            {order.amount_due > 0 && order.collected_amount > 0 ? ` · falta ${formatGs(order.amount_due)}` : ''}
          </Text>
          <Text style={[styles.total, { color: colors.text }]}>{formatGs(order.total)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  header: { gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
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
  smallChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  smallChipText: { fontSize: 12, fontWeight: '700' },
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
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  number: { fontSize: 15, fontWeight: '900' },
  originBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  originText: { fontSize: 10, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  customer: { fontSize: 15, fontWeight: '700' },
  total: { fontSize: 16, fontWeight: '900' },
});
