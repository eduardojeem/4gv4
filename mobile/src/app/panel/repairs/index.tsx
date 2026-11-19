import { BarcodeScanner } from '@/components/barcode-scanner';
import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

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
  TIMELINE,
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
  const [scanning, setScanning] = useState(false);

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

  // Resumen / KPIs rápidos de la carga actual del taller
  const kpis = useMemo(() => {
    let revisar = 0;
    let enTaller = 0;
    let listos = 0;
    let demorados = 0;
    let saldoTotal = 0;

    for (const r of repairs) {
      if (r.status === 'recibido') revisar++;
      if (r.status === 'diagnostico' || r.status === 'reparacion' || r.status === 'pausado') enTaller++;
      if (r.status === 'listo') listos++;
      const days = daysSince(r.created_at);
      if (r.status !== 'entregado' && r.status !== 'cancelado' && days >= 7) demorados++;
      const { balance } = money(r);
      if (balance > 0 && r.status !== 'cancelado') saldoTotal += balance;
    }

    return { revisar, enTaller, listos, demorados, saldoTotal };
  }, [repairs]);

  if (panelLoading || !findItem('repairs')) return <PanelAccessState />;

  const orgName = panelData?.organization.name ?? 'MiTienda';

  return (
    <View style={styles.flex}>
      {/* Encabezado y búsqueda */}
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: colors.text }]}>Reparaciones</Text>
            <Text style={[styles.muted, { color: colors.muted, textAlign: 'left' }]}>
              {loading ? 'Cargando órdenes…' : `${total} ${total === 1 ? 'orden en taller' : 'órdenes en taller'}`}
            </Text>
          </View>
          <Pressable
            disabled={!can('repairs.orders.create')}
            accessibilityState={{ disabled: !can('repairs.orders.create') }}
            onPress={() => router.push('/panel/repairs/new' as never)}
            accessibilityRole="button"
            accessibilityLabel="Registrar nueva orden"
            style={({ pressed }) => [styles.newBtn, { opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Nueva</Text>
          </Pressable>
        </View>

        {/* Buscador inteligente */}
        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ticket, cliente, teléfono o IMEI"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setSearch(query)}
            accessibilityLabel="Buscar reparaciones"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable onPress={() => { setQuery(''); setSearch(''); }} hitSlop={8} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setScanning(true)}
            hitSlop={8}
            accessibilityLabel="Escanear ticket o IMEI con cámara"
            style={styles.scanBtn}>
            <Ionicons name="barcode-outline" size={20} color={palette.primary} />
          </Pressable>
        </View>
      </View>

      {/* Franja de métricas rápidas del taller (KPIs) */}
      {repairs.length > 0 && (
        <View style={styles.kpiContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiList}
            data={[
              {
                id: 'revisar',
                label: 'Por revisar',
                value: String(kpis.revisar),
                icon: 'mail-unread-outline' as const,
                color: palette.primary,
                active: filter === 'recibido',
                onPress: () => changeFilter('recibido'),
              },
              {
                id: 'taller',
                label: 'En taller',
                value: String(kpis.enTaller),
                icon: 'construct-outline' as const,
                color: '#3B82F6',
                active: filter === 'reparacion',
                onPress: () => changeFilter('reparacion'),
              },
              {
                id: 'listos',
                label: 'Listos para retiro',
                value: String(kpis.listos),
                icon: 'checkmark-circle-outline' as const,
                color: '#16A34A',
                active: filter === 'listo',
                onPress: () => changeFilter('listo'),
              },
              ...(kpis.demorados > 0
                ? [
                    {
                      id: 'demorados',
                      label: 'Demorados (+7d)',
                      value: String(kpis.demorados),
                      icon: 'alert-circle-outline' as const,
                      color: palette.danger,
                      active: false,
                      onPress: () => changeFilter('active'),
                    },
                  ]
                : []),
              ...(kpis.saldoTotal > 0
                ? [
                    {
                      id: 'porCobrar',
                      label: 'Por cobrar',
                      value: formatGs(kpis.saldoTotal),
                      icon: 'wallet-outline' as const,
                      color: '#059669',
                      active: false,
                      onPress: () => changeFilter('active'),
                    },
                  ]
                : []),
            ]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={item.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.kpiCard,
                  {
                    backgroundColor: item.active ? `${item.color}15` : colors.card,
                    borderColor: item.active ? item.color : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <View style={[styles.kpiIconBox, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon} size={14} color={item.color} />
                </View>
                <View>
                  <Text style={[styles.kpiValue, { color: colors.text }]}>{item.value}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.muted }]}>{item.label}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Filtros horizontales por estado */}
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
          ListFooterComponent={
            <View>
              {error && <Text accessibilityRole="alert" style={{ color: palette.danger, padding: 12 }}>{error}</Text>}
              {loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}
            </View>
          }
          renderItem={({ item }) => <RepairCard repair={item} colors={colors} orgName={orgName} />}
        />
      )}

      {/* Botón Flotante Ergonómico (FAB para el pulgar) */}
      {can('repairs.orders.create') && (
        <Pressable
          onPress={() => router.push('/panel/repairs/new' as never)}
          accessibilityRole="button"
          accessibilityLabel="Crear nueva reparación"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: palette.primary, opacity: pressed ? 0.9 : 1 },
          ]}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>Nueva orden</Text>
        </Pressable>
      )}

      <BarcodeScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={(code: string) => {
          setScanning(false);
          const cleaned = code.trim().replace(/^#+/, '');
          setQuery(cleaned);
          setSearch(cleaned);
        }}
      />
    </View>
  );
}

function RepairCard({ repair, colors, orgName }: { repair: Repair; colors: ReturnType<typeof usePalette>; orgName: string }) {
  const status = STATUS[repair.status] ?? STATUS.recibido;
  const { total, balance, quoted } = money(repair);
  const priority = repair.priority === 'high' ? PRIORITY.high : null;
  const days = daysSince(repair.created_at);
  const waiting = repair.status !== 'entregado' && repair.status !== 'cancelado' && days >= 7;
  const outcome = repairOutcome(repair);
  const stepIndex = TIMELINE.indexOf(repair.status === 'pausado' ? 'reparacion' : repair.status);
  const phone = repair.customer?.phone?.trim();

  return (
    <Pressable
      onPress={() => router.push(`/panel/repairs/${repair.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${ticketOf(repair)}, ${deviceName(repair)}, ${status.label}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: waiting ? `${palette.danger}66` : colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <View style={[styles.stripe, { backgroundColor: status.color }]} />
      <View style={styles.cardBody}>
        {/* Cabecera de la tarjeta: Ticket, Badge de Estado y Alerta de Urgencia */}
        <View style={styles.rowBetween}>
          <View style={styles.ticketBadgeWrap}>
            <Text style={[styles.ticket, { color: colors.muted }]}>{ticketOf(repair)}</Text>
            {priority && (
              <View style={[styles.priorityPill, { backgroundColor: `${priority.color}18`, borderColor: priority.color }]}>
                <Ionicons name="flash" size={10} color={priority.color} />
                <Text style={[styles.priorityPillText, { color: priority.color }]}>{priority.label}</Text>
              </View>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: `${status.color}1A` }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Identidad del Dispositivo */}
        <View style={styles.deviceRow}>
          <View style={[styles.deviceIconBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name={DEVICE_ICONS[repair.device_type ?? ''] ?? 'hardware-chip-outline'} size={18} color={colors.accent} />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.device, { color: colors.text }]}>
              {deviceName(repair)}
            </Text>
          </View>
          {outcome && (
            <View style={[styles.priority, { borderColor: outcome.color }]}>
              <Text style={[styles.priorityText, { color: outcome.color }]}>{outcome.label}</Text>
            </View>
          )}
        </View>

        {/* Mini línea de tiempo de la orden */}
        {repair.status !== 'cancelado' && (
          <View style={styles.miniStepper}>
            {TIMELINE.map((step, idx) => {
              const isPast = idx < stepIndex;
              const isCurrent = idx === stepIndex;
              const dotColor = isCurrent ? status.color : isPast ? status.color : colors.border;
              return (
                <View key={step} style={styles.miniStepItem}>
                  {idx > 0 && (
                    <View
                      style={[
                        styles.miniStepLine,
                        { backgroundColor: idx <= stepIndex ? status.color : colors.border },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.miniStepDot,
                      {
                        backgroundColor: isCurrent ? status.color : isPast ? status.color : colors.card,
                        borderColor: dotColor,
                      },
                    ]}>
                    {isPast ? <Ionicons name="checkmark" size={7} color="#fff" /> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Problema informado */}
        {repair.problem_description ? (
          <Text numberOfLines={2} style={[styles.problem, { color: colors.muted }]}>
            {repair.problem_description}
          </Text>
        ) : null}

        {/* Fila del Cliente y Acciones Rápidas (Llamar / WhatsApp) */}
        <View style={[styles.cardFooter, { borderColor: colors.border }]}>
          <View style={styles.meta}>
            <Ionicons name="person-outline" size={13} color={colors.muted} />
            <Text numberOfLines={1} style={[styles.metaText, { color: colors.text, fontWeight: '600' }]}>
              {customerName(repair)}
            </Text>
            <Text style={[styles.metaTimeText, { color: waiting ? palette.danger : colors.muted }]}>
              · {shortDate(repair.created_at)}{waiting ? ` (⚠️ ${days}d)` : ` (${days}d)`}
            </Text>
          </View>

          {/* Botones de acción directa si tiene teléfono */}
          {phone ? (
            <View style={styles.quickActionsRow}>
              <Pressable
                onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Llamar a ${customerName(repair)}`}
                style={[styles.quickIconBtn, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="call-outline" size={13} color={colors.text} />
              </Pressable>

              <Pressable
                onPress={() => {
                  const cleanPhone = phone.replace(/[^\d+]/g, '').replace('+', '');
                  const msg = encodeURIComponent(
                    repair.status === 'listo'
                      ? `Hola ${customerName(repair)}, ¡tu equipo ${deviceName(repair)} (${ticketOf(repair)}) ya está listo para retirar en ${orgName}! ${balance > 0 ? `Saldo a abonar: ${formatGs(balance)}.` : 'Totalmente pagado.'}`
                      : `Hola ${customerName(repair)}, te contactamos de ${orgName} sobre tu equipo ${deviceName(repair)} (${ticketOf(repair)}).`
                  );
                  Linking.openURL(`https://wa.me/${cleanPhone}?text=${msg}`);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`WhatsApp a ${customerName(repair)}`}
                style={[styles.quickIconBtn, { borderColor: '#16A34A44', backgroundColor: '#16A34A14' }]}>
                <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Fila inferior: Técnico, Aviso de retiro y Saldo */}
        <View style={styles.rowBetween}>
          <Text style={[styles.metaText, { color: colors.muted }]}>
            {repair.technician?.full_name ? `Téc.: ${repair.technician.full_name}` : 'Sin técnico asignado'}
          </Text>

          {repair.status === 'listo' && phone ? (
            <Pressable
              onPress={() => {
                const cleanPhone = phone.replace(/[^\d+]/g, '').replace('+', '');
                const msg = encodeURIComponent(
                  `Hola ${customerName(repair)}, ¡tu equipo ${deviceName(repair)} (${ticketOf(repair)}) ya está listo para retirar en ${orgName}! ${balance > 0 ? `Saldo a abonar: ${formatGs(balance)}.` : 'Ya se encuentra totalmente abonado.'}`
                );
                Linking.openURL(`https://wa.me/${cleanPhone}?text=${msg}`);
              }}
              accessibilityRole="button"
              accessibilityLabel="Avisar retiro por WhatsApp"
              style={styles.readyWspPill}>
              <Ionicons name="logo-whatsapp" size={11} color="#fff" />
              <Text style={styles.readyWspPillText}>Avisar retiro</Text>
            </Pressable>
          ) : quoted ? (
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
  scanBtn: { paddingLeft: 4, paddingVertical: 4 },
  kpiContainer: { marginTop: 10 },
  kpiList: { paddingHorizontal: 16, gap: 8 },
  kpiCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  kpiIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 13, fontWeight: '800' },
  kpiLabel: { fontSize: 11, fontWeight: '600' },
  filters: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontWeight: '600' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  list: { paddingHorizontal: 16, paddingBottom: 88, gap: 10 },
  more: { paddingVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  stripe: { width: 5 },
  cardBody: { flex: 1, padding: 12, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ticketBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ticket: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  priorityPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  priorityPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceIconBox: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  device: { fontSize: 16, fontWeight: '800' },
  priority: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  priorityText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  miniStepper: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  miniStepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniStepLine: { height: 2, flex: 1 },
  miniStepDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  problem: { fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 12 },
  metaTimeText: { fontSize: 11 },
  quickActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickIconBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  readyWspPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#16A34A', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  readyWspPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  amount: { fontSize: 13, fontWeight: '800' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    zIndex: 50,
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
