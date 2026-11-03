import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchBranchInsights, type BranchInsights } from '@/lib/admin';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', efectivo: 'Efectivo', card: 'Tarjeta', tarjeta: 'Tarjeta', transfer: 'Transferencia',
  transferencia: 'Transferencia', qr: 'QR', credit: 'Crédito', credito: 'Crédito', mixed: 'Mixto', mixto: 'Mixto',
  store_credit: 'Saldo a favor', otro: 'Otro',
};

type IconName = keyof typeof Ionicons.glyphMap;

function lastSale(iso: string | null) {
  if (!iso) return 'Sin ventas todavía';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Última venta: recién';
  if (minutes < 60) return `Última venta: hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `Última venta: hace ${hours} h` : `Última venta: hace ${Math.round(hours / 24)} días`;
}

function weekday(date: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-PY', { weekday: 'narrow', timeZone }).format(new Date(`${date}T12:00:00Z`)).toUpperCase();
}

/**
 * Detalle de una sucursal para el administrador: ventas de hoy, la semana y el
 * mes (sin anuladas y contra el mes pasado), medios de pago, lo que más sale,
 * cajas, stock para reponer, reparaciones y pedidos abiertos.
 */
export default function BranchDetailScreen() {
  const colors = usePalette();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const branchId = params.id ?? '';
  const [data, setData] = useState<BranchInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!branchId) return undefined;
    let active = true;
    fetchBranchInsights(branchId)
      .then((next) => { if (active) { setData(next); setError(null); } })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle.'))
      .finally(() => active && setRefreshing(false));
    return () => { active = false; };
  }, [branchId, attempt]);

  const reload = useCallback(() => { setRefreshing(true); setAttempt((n) => n + 1); }, []);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/admin/branches' as never));

  const sales = data?.sales;
  const maxDay = Math.max(1, ...(sales?.last7Days.daily.map((day) => day.total) ?? [0]));
  const mixTotal = sales?.paymentMix.reduce((total, entry) => total + entry.total, 0) || 1;
  const change = sales?.monthChangePct ?? null;

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver a sucursales" style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: colors.text }]}>{params.name || 'Sucursal'}</Text>
          <Text style={[styles.small, { color: colors.muted }]}>{sales ? lastSale(sales.lastSaleAt) : 'Detalle de la sucursal'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        {!data ? (
          error ? (
            <View style={styles.center}>
              <Text style={[styles.body, { color: colors.text }]}>{error}</Text>
              <Pressable onPress={reload} style={[styles.outlineBtn, { borderColor: colors.border }]} accessibilityRole="button">
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          )
        ) : (
          <>
            {/* Ventas */}
            <View style={[styles.hero, { backgroundColor: palette.primary }]}>
              <Text style={styles.heroLabel}>Ventas de hoy</Text>
              <Text style={styles.heroValue}>{formatGs(data.sales.today.total)}</Text>
              <Text style={styles.heroHelp}>{data.sales.today.count} {data.sales.today.count === 1 ? 'venta' : 'ventas'}</Text>
              <View style={styles.bars} accessibilityLabel="Ventas de los últimos 7 días">
                {data.sales.last7Days.daily.map((day, index) => (
                  <View key={day.date} style={styles.barCol}>
                    <View style={[styles.bar, { height: 6 + (day.total / maxDay) * 44, opacity: index === 6 ? 1 : 0.55 }]} />
                    <Text style={styles.barDay}>{weekday(day.date, data.timeZone)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.grid}>
              <Tile colors={colors} icon="calendar-outline" label="Últimos 7 días" value={formatGs(data.sales.last7Days.total)} help={`${data.sales.last7Days.count} ventas`} />
              <Tile
                colors={colors}
                icon={change === null || change >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
                label="Este mes"
                value={formatGs(data.sales.month.total)}
                help={change === null ? `${data.sales.month.count} ventas` : `${change >= 0 ? '+' : ''}${change}% vs. mes pasado`}
                tone={change === null ? undefined : change >= 0 ? palette.success : palette.danger}
              />
              <Tile colors={colors} icon="receipt-outline" label="Ticket promedio" value={formatGs(data.sales.averageTicket)} help="Del mes" />
              <Tile colors={colors} icon="cash-outline" label="Cajas abiertas" value={`${data.cash.openCount} de ${data.cash.registers.length}`} help={data.cash.registers.filter((r) => r.isOpen).map((r) => r.name).join(', ') || 'Todas cerradas'} />
              <Tile colors={colors} icon="clipboard-outline" label="Pedidos abiertos" value={String(data.orders.open)} help={data.orders.open ? formatGs(data.orders.openTotal) : 'Nada pendiente'} tone={data.orders.open ? '#D97706' : undefined} />
              <Tile colors={colors} icon="construct-outline" label="Reparaciones" value={String(data.repairs.active)} help={`${data.repairs.ready} listas · ${data.repairs.deliveredThisMonth} entregadas`} />
            </View>

            {/* Stock para reponer */}
            <Card colors={colors} icon="alert-circle-outline" title="Stock en alerta" subtitle={`${data.inventory.outOfStock} sin stock · ${data.inventory.lowStock} bajo mínimo`}>
              {data.inventory.alerts.length === 0 ? (
                <Text style={[styles.small, { color: colors.muted }]}>Todo el stock está por encima del mínimo.</Text>
              ) : data.inventory.alerts.map((item) => (
                <View key={item.productId} style={styles.row}>
                  <Text numberOfLines={1} style={[styles.body, styles.flex, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.bold, { color: item.stock <= 0 ? palette.danger : '#D97706' }]}>
                    {item.stock <= 0 ? 'Sin stock' : `${item.stock} (mín. ${item.minStock})`}
                  </Text>
                </View>
              ))}
            </Card>

            {/* Lo que más se vende */}
            <Card colors={colors} icon="trophy-outline" title="Lo que más se vende" subtitle="Este mes">
              {data.sales.topProducts.length === 0 ? (
                <Text style={[styles.small, { color: colors.muted }]}>Sin productos vendidos este mes.</Text>
              ) : data.sales.topProducts.map((product, index) => (
                <View key={product.productId} style={styles.row}>
                  <Text style={[styles.small, styles.rank, { color: colors.muted }]}>{index + 1}</Text>
                  <Text numberOfLines={1} style={[styles.body, styles.flex, { color: colors.text }]}>{product.name}</Text>
                  <Text style={[styles.small, { color: colors.muted }]}>{product.quantity} u.</Text>
                  <Text style={[styles.bold, styles.amount, { color: colors.text }]}>{formatGs(product.total)}</Text>
                </View>
              ))}
            </Card>

            {/* Medios de pago */}
            <Card colors={colors} icon="card-outline" title="Medios de pago" subtitle="Este mes">
              {data.sales.paymentMix.length === 0 ? (
                <Text style={[styles.small, { color: colors.muted }]}>Sin ventas este mes.</Text>
              ) : data.sales.paymentMix.map((entry) => (
                <View key={entry.method} style={styles.mix}>
                  <View style={styles.row}>
                    <Text style={[styles.body, styles.flex, { color: colors.text }]}>{PAYMENT_LABELS[entry.method] ?? entry.method}</Text>
                    <Text style={[styles.bold, { color: colors.text }]}>{formatGs(entry.total)}</Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.border }]}>
                    <View style={[styles.fill, { width: `${(entry.total / mixTotal) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </Card>

            {/* Cajas */}
            {data.cash.registers.length > 0 && (
              <Card colors={colors} icon="wallet-outline" title="Cajas">
                {data.cash.registers.map((register) => (
                  <View key={register.id} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: register.isOpen ? palette.success : colors.border }]} />
                    <Text style={[styles.body, styles.flex, { color: colors.text }]}>{register.name}</Text>
                    <Text style={[styles.small, { color: colors.muted }]}>{register.isOpen ? `Abierta · ${formatGs(register.balance)}` : 'Cerrada'}</Text>
                  </View>
                ))}
              </Card>
            )}

            <Text style={[styles.foot, { color: colors.muted }]}>
              {data.inventory.trackedProducts} productos con stock ({data.inventory.units} unidades). Las ventas anuladas no se cuentan.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

type Colors = ReturnType<typeof usePalette>;

function Tile({ colors, icon, label, value, help, tone }: { colors: Colors; icon: IconName; label: string; value: string; help: string; tone?: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name={icon} size={17} color={tone ?? palette.primary} />
      <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.text }]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.small, { color: tone ?? colors.muted }]}>{help}</Text>
    </View>
  );
}

function Card({ colors, icon, title, subtitle, children }: { colors: Colors; icon: IconName; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={18} color={palette.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.small, { color: colors.muted }]}>· {subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  loading: { paddingVertical: 40 },
  center: { alignItems: 'center', gap: 10, padding: 32 },
  body: { fontSize: 14 },
  bold: { fontSize: 13, fontWeight: '800' },
  small: { fontSize: 12 },
  outlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  hero: { borderRadius: 20, padding: 18 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 2 },
  heroHelp: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, height: 66 },
  barCol: { alignItems: 'center', gap: 4, flex: 1 },
  bar: { width: 14, borderRadius: 5, backgroundColor: '#fff' },
  barDay: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47.5%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 3 },
  tileValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  tileLabel: { fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { width: 14 },
  amount: { minWidth: 90, textAlign: 'right' },
  mix: { gap: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: palette.primary, borderRadius: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  foot: { fontSize: 12, textAlign: 'center' },
});
