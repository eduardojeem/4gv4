import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  customerName,
  daysSince,
  DEVICE_ICONS,
  deviceName,
  fetchRepairs,
  FILTERS,
  money,
  onRepairUpdated,
  PRIORITY,
  rememberRepairs,
  repairOutcome,
  shortDate,
  STATUS,
  ticketOf,
  type Repair,
  type RepairFilter,
} from '@/lib/repairs';

export default function RepairsScreen() {
  const colors = usePalette();
  const { data: panelData, findItem, can, loading: panelLoading } = usePanel();
  const [filter, setFilter] = useState<RepairFilter>('active');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Busca medio segundo después de dejar de escribir.
  const requestScope = useListRequestScope(JSON.stringify([panelData?.organization.id, panelData?.organization.role, panelData?.user.email,search,filter,attempt]));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 450);
    return () => clearTimeout(timer);
  }, [query]);

  // Primera página cada vez que cambia el filtro, la búsqueda o se recarga.
  useEffect(() => {
    let active = true;
    if (!panelData || !findItem('repairs')) return () => { active = false; };
    queueMicrotask(() => { if (active) { setLoading(true); setLoadingMore(false); } });
    fetchRepairs({ page: 1, filter, search })
      .then((result) => {
        if (!active) return;
        rememberRepairs(result.repairs);
        setRepairs(result.repairs);
        setPage(1);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar las reparaciones.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [filter, search, attempt, panelData, findItem]);

  // Un cambio de estado hecho en el detalle se ve al volver a la lista.
  useEffect(
    () => onRepairUpdated((updated) => setRepairs((list) => list.map((repair) => (repair.id === updated.id ? updated : repair)))),
    []
  );

  const changeFilter = (next: RepairFilter) => {
    if (next === filter) return;
    setLoading(true);
    setFilter(next);
  };

  const refresh = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    const isCurrent = requestScope.capture();
    setLoadingMore(true);
    fetchRepairs({ page: page + 1, filter, search })
      .then((result) => {
        if (!isCurrent()) return;
        setError(null);
        rememberRepairs(result.repairs);
        setRepairs((list) => [...list, ...result.repairs.filter((repair) => !list.some((item) => item.id === repair.id))]);
        setPage(page + 1);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((err) => { if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.'); })
      .finally(() => { if (isCurrent()) setLoadingMore(false); });
  };

  if (panelLoading || !findItem('repairs')) return <PanelAccessState />;

  return (
    <View style={styles.flex}>
      {/* Encabezado y búsqueda */}
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: colors.text }]}>Reparaciones</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>
              {loading ? 'Cargando…' : `${total} ${total === 1 ? 'orden' : 'órdenes'}`}
            </Text>
          </View>
          <Pressable
            disabled={!can('repairs.orders.create')} accessibilityState={{ disabled: !can('repairs.orders.create') }} onPress={() => router.push('/panel/repairs/new' as never)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.newBtn, { opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newBtnText}>Nueva</Text>
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ticket, cliente, teléfono o equipo"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setSearch(query)}
            accessibilityLabel="Buscar reparaciones"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filtros por estado */}
      <View>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const selected = item.key === filter;
            const tone = item.key in STATUS ? STATUS[item.key as keyof typeof STATUS].color : palette.primary;
            return (
              <Pressable
                onPress={() => changeFilter(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.filter,
                  { borderColor: selected ? tone : colors.border, backgroundColor: selected ? `${tone}18` : colors.card },
                ]}>
                <Text style={[styles.filterText, { color: selected ? tone : colors.text }, selected && styles.bold]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : error && repairs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.muted} />
          <Text style={[styles.muted, { color: colors.muted }]}>{error}</Text>
          <Pressable onPress={refresh} style={[styles.outline, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={repairs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={32} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{search ? 'Sin resultados' : 'No hay reparaciones'}</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>
                {search ? `Nada coincide con «${search}».` : 'No hay órdenes con este filtro.'}
              </Text>
            </View>
          }
          ListFooterComponent={<View>{error && <Text accessibilityRole="alert" style={{ color: palette.danger, padding: 12 }}>{error}</Text>}{loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}</View>}
          renderItem={({ item }) => <RepairCard repair={item} colors={colors} />}
        />
      )}
    </View>
  );
}

function RepairCard({ repair, colors }: { repair: Repair; colors: ReturnType<typeof usePalette> }) {
  const status = STATUS[repair.status] ?? STATUS.recibido;
  const { total, balance, quoted } = money(repair);
  const priority = repair.priority === 'high' ? PRIORITY.high : null;
  const days = daysSince(repair.created_at);
  const waiting = repair.status !== 'entregado' && repair.status !== 'cancelado' && days >= 7;
  const outcome = repairOutcome(repair);

  return (
    <Pressable
      onPress={() => router.push(`/panel/repairs/${repair.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${ticketOf(repair)}, ${deviceName(repair)}, ${status.label}`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.stripe, { backgroundColor: status.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <Text style={[styles.ticket, { color: colors.muted }]}>{ticketOf(repair)}</Text>
          <View style={[styles.badge, { backgroundColor: `${status.color}1A` }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.deviceRow}>
          <Ionicons name={DEVICE_ICONS[repair.device_type ?? ''] ?? 'hardware-chip-outline'} size={18} color={colors.text} />
          <Text numberOfLines={1} style={[styles.device, { color: colors.text }]}>{deviceName(repair)}</Text>
          {outcome && (
            <View style={[styles.priority, { borderColor: outcome.color }]}>
              <Text style={[styles.priorityText, { color: outcome.color }]}>{outcome.label}</Text>
            </View>
          )}
          {priority && (
            <View style={[styles.priority, { borderColor: priority.color }]}>
              <Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text>
            </View>
          )}
        </View>
        {repair.problem_description ? (
          <Text numberOfLines={2} style={[styles.problem, { color: colors.muted }]}>{repair.problem_description}</Text>
        ) : null}

        <View style={[styles.cardFooter, { borderColor: colors.border }]}>
          <View style={styles.meta}>
            <Ionicons name="person-outline" size={13} color={colors.muted} />
            <Text numberOfLines={1} style={[styles.metaText, { color: colors.text }]}>{customerName(repair)}</Text>
          </View>
          <Text style={[styles.metaText, { color: waiting ? palette.danger : colors.muted }]}>
            {shortDate(repair.created_at)}{waiting ? ` · ${days} días` : ''}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={[styles.metaText, { color: colors.muted }]}>
            {repair.technician?.full_name ? `Téc.: ${repair.technician.full_name}` : 'Sin técnico asignado'}
          </Text>
          {quoted ? (
            <Text style={[styles.amount, { color: balance > 0 ? colors.text : palette.success }]}>
              {balance > 0 ? `Saldo ${formatGs(balance)}` : `Pagado ${formatGs(total)}`}
            </Text>
          ) : (
            <Text style={[styles.metaText, { color: colors.muted }]}>A presupuestar</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  top: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13, textAlign: 'center' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontWeight: '600' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  more: { paddingVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  stripe: { width: 4 },
  cardBody: { flex: 1, padding: 12, gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ticket: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  device: { flex: 1, fontSize: 16, fontWeight: '800' },
  priority: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  priorityText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  problem: { fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  metaText: { fontSize: 12 },
  amount: { fontSize: 13, fontWeight: '800' },
});
