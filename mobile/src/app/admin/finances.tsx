import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchFinanceSummary, type FinanceSummaryData } from '@/lib/admin';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

type Period = 'today' | 'month' | '30d' | 'year';

function getPeriodDates(period: Period) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === 'today') {
    const today = toIsoDate(now);
    return { startDate: today, endDate: today };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: toIsoDate(start), endDate: toIsoDate(now) };
  }
  if (period === '30d') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: toIsoDate(start), endDate: toIsoDate(now) };
  }
  // year
  const start = new Date(now.getFullYear(), 0, 1);
  return { startDate: toIsoDate(start), endDate: toIsoDate(now) };
}

export default function FinancesAdminScreen() {
  const colors = usePalette();
  const [data, setData] = useState<FinanceSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const { startDate, endDate } = getPeriodDates(period);
    fetchFinanceSummary({ startDate, endDate })
      .then((res) => {
        if (!active) return;
        setData(res);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo cargar el balance.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [period, attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const netProfit = data?.accrued.netProfit ?? 0;
  const isPositiveProfit = netProfit >= 0;

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Text style={[styles.topTitle, { color: colors.text }]}>Finanzas</Text>
        <Text style={[styles.topSub, { color: colors.muted }]}>Resultados económicos y flujo de caja</Text>
      </View>

      {/* Selector de periodo */}
      <View style={styles.periodRow}>
        {(
          [
            { key: 'today', label: 'Hoy' },
            { key: 'month', label: 'Este mes' },
            { key: '30d', label: 'Últimos 30d' },
            { key: 'year', label: 'Este año' },
          ] as const
        ).map((item) => {
          const active = period === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setPeriod(item.key)}
              style={[
                styles.periodTab,
                {
                  backgroundColor: active ? palette.primary : colors.card,
                  borderColor: active ? palette.primary : colors.border,
                },
              ]}>
              <Text style={[styles.periodText, { color: active ? '#fff' : colors.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        {!data ? (
          error ? (
            <View style={styles.centerBox}>
              <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
              <Pressable onPress={reload} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          )
        ) : (
          <>
            {/* Hero Card: Resultado Neto */}
            <View
              style={[
                styles.heroCard,
                { backgroundColor: isPositiveProfit ? '#15803D' : '#B91C1C' },
              ]}>
              <Text style={styles.heroSub}>Resultado Neto del período</Text>
              <Text style={styles.heroVal}>{formatGs(netProfit)}</Text>
              <View style={styles.heroPill}>
                <Ionicons
                  name={isPositiveProfit ? 'trending-up' : 'trending-down'}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.heroPillText}>
                  {isPositiveProfit ? 'Ganancia Neta' : 'Pérdida'}
                </Text>
              </View>
            </View>

            {/* Cuadro de Resultados Devengados */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Estado de Resultados</Text>

              <View style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Facturación bruta</Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>Ventas, tienda web y servicios</Text>
                </View>
                <Text style={[styles.rowVal, { color: '#16A34A' }]}>{formatGs(data.accrued.revenue)}</Text>
              </View>

              <View style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Costo de mercadería</Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>Costo directo de productos y repuestos</Text>
                </View>
                <Text style={[styles.rowVal, { color: colors.text }]}>- {formatGs(data.accrued.directCosts)}</Text>
              </View>

              <View style={[styles.row, styles.highlightRow, { backgroundColor: 'rgba(37,99,235,0.06)' }]}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.bold, { color: palette.primary }]}>Margen Bruto</Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>Ingresos menos costo directo</Text>
                </View>
                <Text style={[styles.bold, { color: palette.primary }]}>
                  {formatGs(data.accrued.grossProfit ?? 0)}
                </Text>
              </View>

              <View style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Gastos operativos</Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>Alquiler, servicios, insumos</Text>
                </View>
                <Text style={[styles.rowVal, { color: colors.text }]}>
                  - {formatGs(data.accrued.operatingExpenses)}
                </Text>
              </View>

              <View style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Costo laboral</Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>Sueldos, comisiones del equipo</Text>
                </View>
                <Text style={[styles.rowVal, { color: colors.text }]}>
                  - {formatGs(data.accrued.payrollCost)}
                </Text>
              </View>
            </View>

            {/* Flujo de Caja en Efectivo */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="wallet-outline" size={18} color={palette.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Flujo de Caja (Efectivo)</Text>
              </View>

              <View style={styles.grid2}>
                <View style={[styles.miniKpi, { borderColor: colors.border }]}>
                  <Text style={[styles.small, { color: colors.muted }]}>Total cobrado</Text>
                  <Text style={[styles.bold, { color: '#16A34A', fontSize: 16 }]}>
                    {formatGs(data.cash.collected)}
                  </Text>
                </View>

                <View style={[styles.miniKpi, { borderColor: colors.border }]}>
                  <Text style={[styles.small, { color: colors.muted }]}>Total pagado</Text>
                  <Text style={[styles.bold, { color: '#DC2626', fontSize: 16 }]}>
                    {formatGs(data.cash.paid)}
                  </Text>
                </View>
              </View>

              <View style={[styles.cashNetRow, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Saldo Neto de Caja</Text>
                <Text
                  style={[
                    styles.bold,
                    {
                      fontSize: 16,
                      color: data.cash.netCashFlow >= 0 ? '#16A34A' : '#DC2626',
                    },
                  ]}>
                  {formatGs(data.cash.netCashFlow)}
                </Text>
              </View>
            </View>

            {/* Obligaciones Vencidas */}
            {data.overdue.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: '#DC262655' }]}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={[styles.cardTitle, { color: '#DC2626' }]}>
                    Vencimientos Atrasados ({data.overdue.length})
                  </Text>
                </View>
                {data.overdue.map((item) => (
                  <View key={item.id} style={[styles.dueRow, { borderColor: colors.border }]}>
                    <View style={styles.flex}>
                      <Text style={[styles.bold, { color: colors.text }]}>
                        {item.concept || 'Obligación pendiente'}
                      </Text>
                      <Text style={[styles.small, { color: '#DC2626' }]}>Venció: {item.dueDate}</Text>
                    </View>
                    <Text style={[styles.bold, { color: '#DC2626' }]}>{formatGs(item.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Próximos Vencimientos */}
            {data.upcomingDue.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="calendar-outline" size={18} color={palette.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Próximos Vencimientos ({data.upcomingDue.length})
                  </Text>
                </View>
                {data.upcomingDue.map((item) => (
                  <View key={item.id} style={[styles.dueRow, { borderColor: colors.border }]}>
                    <View style={styles.flex}>
                      <Text style={[styles.bold, { color: colors.text }]}>
                        {item.concept || 'Obligación a pagar'}
                      </Text>
                      <Text style={[styles.small, { color: colors.muted }]}>Vence: {item.dueDate}</Text>
                    </View>
                    <Text style={[styles.bold, { color: colors.text }]}>{formatGs(item.amount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  topSub: { fontSize: 12, marginTop: 1 },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  periodTab: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  periodText: { fontSize: 12, fontWeight: '700' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  loading: { paddingVertical: 40 },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  bold: { fontSize: 14, fontWeight: '800' },
  small: { fontSize: 12 },
  outlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  heroCard: {
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  heroVal: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  heroPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  highlightRow: {
    paddingHorizontal: 10,
    borderRadius: 10,
    borderTopWidth: 0,
    marginVertical: 4,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 13, fontWeight: '700' },
  rowSub: { fontSize: 11 },
  rowVal: { fontSize: 14, fontWeight: '800' },
  grid2: { flexDirection: 'row', gap: 10 },
  miniKpi: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  cashNetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
});
