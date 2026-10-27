import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FirstStepsCard } from '@/components/first-steps-card';
import { apiFetch } from '@/lib/api';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { hasNativePanelSection, iconFor, panelRoute, usePanel } from '@/lib/panel';
import { fetchProducts } from '@/lib/products';
import { fetchQuotes } from '@/lib/quotes';
import { getPrivateCacheContext, isPrivateCacheSnapshotCompatible, subscribePrivateCacheContext } from '@/lib/private-cache-context';

/** Lo que devuelve /api/dashboard/summary: el mismo resumen del dashboard web. */
type Summary = {
  organizationId: string;
  branchId: string | null;
  timeZone: string;
  today: string;
  generatedAt: string;
  salesToday: { count: number; amount: number; trend: number[] };
  activeOrders: number;
  customersNew: { count: number };
  catalog: { total: number; lowStock: number };
  repairs: { active: number; ready: { count: number } };
  recentActivity: { id: string; type: 'sale' | 'repair' | 'customer'; description: string; amount?: number; createdAt: string }[];
};

const ACTIVITY_ICONS = { sale: 'cart-outline', repair: 'construct-outline', customer: 'person-add-outline' } as const;
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Buen día' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function trendDayLabel(today: string, index: number, timeZone: string) {
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 6 + index, 12));
  return new Intl.DateTimeFormat('es-PY', { weekday: 'narrow', timeZone }).format(date).replace('.', '').toLocaleUpperCase('es-PY');
}

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} d`;
}

export default function PanelOverview() {
  const colors = usePalette();
  const { data: panel, error: panelError, reload: reloadPanel, findItem } = usePanel();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scopedError, setScopedError] = useState<{ scope: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [workshopMetrics, setWorkshopMetrics] = useState<{ scope: string; quotes: number | null; inventory: number | null; error: string | null }>({ scope: '', quotes: null, inventory: null, error: null });
  const [branchId, setBranchId] = useState(() => getPrivateCacheContext().branchId);
  const organizationId = panel?.organization.id ?? null;
  const scopeKey = JSON.stringify([panel?.user.email ?? null, organizationId, branchId]);
  const has = useCallback((key: string) => Boolean(findItem(key)), [findItem]);
  const error = scopedError?.scope === scopeKey ? scopedError.message : null;

  useEffect(() => subscribePrivateCacheContext((next) => setBranchId(next.branchId)), []);

  useEffect(() => {
    if (!organizationId) {
      return undefined;
    }

    let active = true;
    apiFetch<Summary>('/api/dashboard/summary')
      .then((next) => {
        if (!active) return;
        if (next.organizationId !== organizationId || next.branchId !== branchId) return;
        setSummary(next);
        setScopedError(null);
      })
      .catch((err) => {
        if (active) setScopedError({ scope: scopeKey, message: err instanceof Error ? err.message : 'No se pudo cargar el resumen.' });
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, organizationId, branchId, scopeKey]);

  useEffect(() => {
    if (!organizationId || (!has('quotes') && !has('repair-inventory'))) return undefined;
    let active = true;
    const privateScope = getPrivateCacheContext();
    const quotesRequest = has('quotes')
      ? fetchQuotes({ page: 1, status: 'open' })
      : Promise.resolve(null);
    const inventoryRequest = has('repair-inventory')
      ? fetchProducts({ page: 1, stock: 'low_stock', catalogKind: 'physical' })
      : Promise.resolve(null);

    Promise.all([quotesRequest, inventoryRequest])
      .then(([quotes, inventory]) => {
        if (!active || !isPrivateCacheSnapshotCompatible(privateScope)) return;
        setWorkshopMetrics({
          scope: scopeKey,
          quotes: quotes?.available ? quotes.pagination.total : null,
          inventory: inventory?.total ?? null,
          error: null,
        });
      })
      .catch((err) => {
        if (!active || !isPrivateCacheSnapshotCompatible(privateScope)) return;
        setWorkshopMetrics({ scope: scopeKey, quotes: null, inventory: null, error: err instanceof Error ? err.message : 'No se pudieron cargar los indicadores del taller.' });
      });

    return () => { active = false; };
  }, [attempt, organizationId, branchId, scopeKey, has]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    reloadPanel();
    setAttempt((n) => n + 1);
  }, [reloadPanel]);

  const firstName = (panel?.user.name ?? '').split(' ')[0];
  const quick = (panel?.groups.flatMap((group) => group.items) ?? []).filter((item) => !['overview', 'quotes', 'repair-inventory'].includes(item.key)).slice(0, 8);
  const visibleSummary = summary?.organizationId === organizationId && summary.branchId === branchId ? summary : null;
  const visibleWorkshopMetrics = workshopMetrics.scope === scopeKey ? workshopMetrics : null;
  const showWorkshopSection = has('quotes') || has('repair-inventory');
  const workshopMetricsLoading = showWorkshopSection && Boolean(organizationId) && !visibleWorkshopMetrics;
  const trend = visibleSummary?.salesToday.trend ?? [];
  const maxTrend = Math.max(1, ...trend);

  const kpis = visibleSummary
    ? [
        { key: 'sales', show: has('pos'), icon: 'cash-outline' as const, label: 'Ventas de hoy', value: formatGs(visibleSummary.salesToday.amount), help: `${visibleSummary.salesToday.count} ${visibleSummary.salesToday.count === 1 ? 'venta' : 'ventas'}`, route: has('pos') ? panelRoute('pos') : null, tone: '#16A34A' },
        { key: 'orders', show: has('orders'), icon: 'clipboard-outline' as const, label: 'Pedidos activos', value: String(visibleSummary.activeOrders), help: 'Por preparar o entregar', route: panelRoute('orders'), tone: '#2563EB' },
        { key: 'repairs', show: has('repairs'), icon: 'construct-outline' as const, label: 'Reparaciones', value: String(visibleSummary.repairs.active), help: `${visibleSummary.repairs.ready.count} listas para entregar`, route: panelRoute('repairs'), tone: '#7C3AED' },
        { key: 'stock', show: has('products'), icon: 'alert-circle-outline' as const, label: 'Stock bajo', value: String(visibleSummary.catalog.lowStock), help: `de ${visibleSummary.catalog.total} en catálogo`, route: panelRoute('products'), tone: visibleSummary.catalog.lowStock > 0 ? '#DC2626' : '#64748B' },
        { key: 'customers', show: has('customers'), icon: 'people-outline' as const, label: 'Clientes nuevos', value: String(visibleSummary.customersNew.count), help: 'Últimos 7 días', route: panelRoute('customers'), tone: '#0891B2' },
      ].filter((kpi) => kpi.show)
    : [];

  if (panelError && !panel) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>No se pudo cargar el panel</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>{panelError}</Text>
        <Pressable onPress={refresh} style={[styles.outlineBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} />}>
      <View>
        <Text style={[styles.hello, { color: colors.muted }]}>{greeting()}{firstName ? `, ${firstName}` : ''}</Text>
        <Text style={[styles.title, { color: colors.text }]}>Resumen del negocio</Text>
      </View>

      <FirstStepsCard />

      {!visibleSummary && !error && (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}
      {error && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: palette.danger, fontWeight: '600' }}>{error}{visibleSummary ? ' Se muestran los últimos datos disponibles.' : ''}</Text>
          <Pressable onPress={refresh} style={[styles.outlineBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {visibleSummary && (
        <>
          {/* Ventas de la semana */}
          <View style={[styles.hero, { backgroundColor: palette.primary }]}>
            <Text style={styles.heroLabel}>Ventas de hoy</Text>
            <Text style={styles.heroValue}>{formatGs(visibleSummary.salesToday.amount)}</Text>
            <Text style={styles.heroHelp}>
              {visibleSummary.salesToday.count} {visibleSummary.salesToday.count === 1 ? 'venta cobrada' : 'ventas cobradas'}
            </Text>
            {trend.length === 7 && (
              <View style={styles.bars} accessibilityLabel="Ventas de los últimos 7 días">
                {trend.map((value, index) => (
                  <View key={index} style={styles.barCol}>
                    <View style={[styles.bar, { height: 6 + (value / maxTrend) * 44, opacity: index === 6 ? 1 : 0.55 }]} />
                    <Text style={styles.barDay}>{trendDayLabel(visibleSummary.today, index, visibleSummary.timeZone)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Indicadores */}
          <View style={styles.grid}>
            {kpis.filter((kpi) => kpi.key !== 'sales').map((kpi) => (
              <Pressable
                key={kpi.key}
                disabled={!kpi.route}
                onPress={() => kpi.route && router.navigate(kpi.route as never)}
                style={({ pressed }) => [styles.kpi, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
                <View style={[styles.kpiIcon, { backgroundColor: `${kpi.tone}1A` }]}>
                  <Ionicons name={kpi.icon} size={18} color={kpi.tone} />
                </View>
                <Text style={[styles.kpiValue, { color: colors.text }]}>{kpi.value}</Text>
                <Text style={[styles.kpiLabel, { color: colors.text }]}>{kpi.label}</Text>
                <Text numberOfLines={1} style={[styles.kpiHelp, { color: colors.muted }]}>{kpi.help}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {visibleSummary && <Text style={{color:colors.muted}}>Última actualización: {new Date(visibleSummary.generatedAt).toLocaleTimeString('es-PY')}</Text>}
      {showWorkshopSection && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Taller</Text>
          <View style={styles.workshopGrid}>
            {has('quotes') && (
              <Pressable
                onPress={() => router.navigate(panelRoute('quotes') as never)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.workshopCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}>
                <View style={[styles.workshopIcon, { backgroundColor: '#2563EB18' }]}>
                  <Ionicons name="document-text-outline" size={19} color="#2563EB" />
                </View>
                <Text style={[styles.workshopValue, { color: colors.text }]}>{workshopMetricsLoading ? '…' : visibleWorkshopMetrics?.quotes ?? '—'}</Text>
                <Text style={[styles.workshopLabel, { color: colors.text }]}>Presupuestos en curso</Text>
                <Text style={[styles.kpiHelp, { color: colors.muted }]}>Borradores y enviados</Text>
              </Pressable>
            )}
            {has('repair-inventory') && (
              <Pressable
                onPress={() => router.navigate(panelRoute('repair-inventory') as never)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.workshopCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}>
                <View style={[styles.workshopIcon, { backgroundColor: '#D9770618' }]}>
                  <Ionicons name="file-tray-stacked-outline" size={19} color="#D97706" />
                </View>
                <Text style={[styles.workshopValue, { color: colors.text }]}>{workshopMetricsLoading ? '…' : visibleWorkshopMetrics?.inventory ?? '—'}</Text>
                <Text style={[styles.workshopLabel, { color: colors.text }]}>Repuestos con alerta</Text>
                <Text style={[styles.kpiHelp, { color: colors.muted }]}>Bajo mínimo o sin stock</Text>
              </Pressable>
            )}
          </View>
          {visibleWorkshopMetrics?.error ? <Text accessibilityRole="alert" style={{ color: palette.danger, fontSize: 12 }}>{visibleWorkshopMetrics.error}</Text> : null}
        </View>
      )}
      {/* Accesos rápidos: las secciones que el usuario ve en la web */}
      {quick.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Accesos rápidos</Text>
          <View style={styles.quickGrid}>
            {quick.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => router.navigate(panelRoute(item.key) as never)}
                style={({ pressed }) => [styles.quick, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.quickIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name={iconFor(item.key)} size={22} color={palette.primary} />
                </View>
                <Text numberOfLines={2} style={[styles.quickLabel, { color: colors.text }]}>{item.mobileLabel ?? item.label}{!hasNativePanelSection(item.key) ? ' · Web' : ''}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Actividad reciente */}
      {visibleSummary && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Actividad reciente</Text>
          <View style={[styles.card, styles.noPad, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {visibleSummary.recentActivity.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>Sin movimientos en las últimas 72 horas.</Text>
            ) : (
              visibleSummary.recentActivity.map((item, index) => (
                <View key={item.id} style={[styles.activity, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                  <View style={[styles.activityIcon, { backgroundColor: colors.background }]}>
                    <Ionicons name={ACTIVITY_ICONS[item.type]} size={16} color={colors.text} />
                  </View>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={[styles.activityText, { color: colors.text }]}>{item.description}</Text>
                    <Text style={[styles.kpiHelp, { color: colors.muted }]}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  {item.amount ? <Text style={[styles.activityAmount, { color: colors.text }]}>{formatGs(item.amount)}</Text> : null}
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  loading: { paddingVertical: 32 },
  hello: { fontSize: 14 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { textAlign: 'center' },
  errorTitle: { fontSize: 16, fontWeight: '700' },
  outlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', marginTop: 6 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  noPad: { padding: 0, gap: 0 },
  hero: { borderRadius: 20, padding: 18 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 },
  heroHelp: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, height: 66 },
  barCol: { alignItems: 'center', gap: 4, flex: 1 },
  bar: { width: 14, borderRadius: 5, backgroundColor: '#fff' },
  barDay: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { width: '47.5%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 2 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 13, fontWeight: '700' },
  kpiHelp: { fontSize: 12 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  workshopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  workshopCard: { width: '47.5%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 2 },
  workshopIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  workshopValue: { fontSize: 24, fontWeight: '800' },
  workshopLabel: { fontSize: 13, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  quick: { width: '25%', alignItems: 'center', gap: 6 },
  quickIcon: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 2 },
  empty: { padding: 16, textAlign: 'center' },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  activityIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityText: { fontSize: 14, fontWeight: '600' },
  activityAmount: { fontSize: 14, fontWeight: '800' },
});
