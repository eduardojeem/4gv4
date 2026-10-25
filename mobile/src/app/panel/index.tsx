import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FirstStepsCard } from '@/components/first-steps-card';
import { apiFetch } from '@/lib/api';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { hasNativePanelSection, iconFor, panelRoute, usePanel } from '@/lib/panel';

/** Lo que devuelve /api/dashboard/summary: el mismo resumen del dashboard web. */
type Summary = {
  salesToday: { count: number; amount: number; trend: number[] };
  activeOrders: number;
  customersNew: { count: number };
  catalog: { total: number; lowStock: number };
  repairs: { active: number; ready: { count: number } };
  recentActivity: { id: string; type: 'sale' | 'repair' | 'customer'; description: string; amount?: number; createdAt: string }[];
};

const ACTIVITY_ICONS = { sale: 'cart-outline', repair: 'construct-outline', customer: 'person-add-outline' } as const;
const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Buen día' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
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
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<Summary>('/api/dashboard/summary')
      .then((next) => {
        if (!active) return;
        setSummary(next);
        setLastSuccess(new Date());
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.');
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    reloadPanel();
    setAttempt((n) => n + 1);
  }, [reloadPanel]);

  const has = (key: string) => Boolean(findItem(key));
  const firstName = (panel?.user.name ?? '').split(' ')[0];
  const quick = (panel?.groups.flatMap((group) => group.items) ?? []).filter((item) => item.key !== 'overview').slice(0, 8);
  const trend = summary?.salesToday.trend ?? [];
  const maxTrend = Math.max(1, ...trend);
  const today = new Date().getDay();

  const kpis = summary
    ? [
        { key: 'sales', show: true, icon: 'cash-outline' as const, label: 'Ventas de hoy', value: formatGs(summary.salesToday.amount), help: `${summary.salesToday.count} ${summary.salesToday.count === 1 ? 'venta' : 'ventas'}`, route: has('pos') ? panelRoute('pos') : null, tone: '#16A34A' },
        { key: 'orders', show: has('orders'), icon: 'clipboard-outline' as const, label: 'Pedidos activos', value: String(summary.activeOrders), help: 'Por preparar o entregar', route: panelRoute('orders'), tone: '#2563EB' },
        { key: 'repairs', show: has('repairs'), icon: 'construct-outline' as const, label: 'Reparaciones', value: String(summary.repairs.active), help: `${summary.repairs.ready.count} listas para entregar`, route: panelRoute('repairs'), tone: '#7C3AED' },
        { key: 'stock', show: has('products'), icon: 'alert-circle-outline' as const, label: 'Stock bajo', value: String(summary.catalog.lowStock), help: `de ${summary.catalog.total} en catálogo`, route: panelRoute('products'), tone: summary.catalog.lowStock > 0 ? '#DC2626' : '#64748B' },
        { key: 'customers', show: has('customers'), icon: 'people-outline' as const, label: 'Clientes nuevos', value: String(summary.customersNew.count), help: 'Últimos 7 días', route: panelRoute('customers'), tone: '#0891B2' },
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

      {!summary && !error && (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}
      {error && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: palette.danger, fontWeight: '600' }}>{error}{summary ? ' Se muestran los últimos datos disponibles.' : ''}</Text>
          <Pressable onPress={refresh} style={[styles.outlineBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {summary && (
        <>
          {/* Ventas de la semana */}
          <View style={[styles.hero, { backgroundColor: palette.primary }]}>
            <Text style={styles.heroLabel}>Ventas de hoy</Text>
            <Text style={styles.heroValue}>{formatGs(summary.salesToday.amount)}</Text>
            <Text style={styles.heroHelp}>
              {summary.salesToday.count} {summary.salesToday.count === 1 ? 'venta cobrada' : 'ventas cobradas'}
            </Text>
            {trend.length === 7 && (
              <View style={styles.bars} accessibilityLabel="Ventas de los últimos 7 días">
                {trend.map((value, index) => (
                  <View key={index} style={styles.barCol}>
                    <View style={[styles.bar, { height: 6 + (value / maxTrend) * 44, opacity: index === 6 ? 1 : 0.55 }]} />
                    <Text style={styles.barDay}>{WEEKDAYS[(today - 6 + index + 7) % 7]}</Text>
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

      {lastSuccess && <Text style={{color:colors.muted}}>Última actualización: {lastSuccess.toLocaleTimeString('es-PY')}</Text>}
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
      {summary && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Actividad reciente</Text>
          <View style={[styles.card, styles.noPad, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {summary.recentActivity.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>Sin movimientos en las últimas 72 horas.</Text>
            ) : (
              summary.recentActivity.map((item, index) => (
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
