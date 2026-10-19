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

import { fetchOverview, fetchWebsiteAnalytics, type AdminOverview, type WebsiteAnalytics } from '@/lib/admin';
import { formatGs, openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

type DaysRange = 7 | 30 | 90;

export default function AnalyticsAdminScreen() {
  const colors = usePalette();
  const [days, setDays] = useState<DaysRange>(30);
  const [analytics, setAnalytics] = useState<WebsiteAnalytics | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchWebsiteAnalytics(days).catch(() => null),
      fetchOverview().catch(() => null),
    ])
      .then(([analyticsRes, overviewRes]) => {
        if (!active) return;
        setAnalytics(analyticsRes);
        setOverview(overviewRes);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar la analítica.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [days, attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const summary = analytics?.summary;

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Text style={[styles.topTitle, { color: colors.text }]}>Analítica y Rendimiento</Text>
        <Text style={[styles.topSub, { color: colors.muted }]}>Tráfico web, visitas y conversión comercial</Text>
      </View>

      {/* Rango de días */}
      <View style={styles.daysRow}>
        {([7, 30, 90] as const).map((d) => {
          const active = days === d;
          return (
            <Pressable
              key={d}
              onPress={() => setDays(d)}
              style={[
                styles.dayChip,
                {
                  backgroundColor: active ? palette.primary : colors.card,
                  borderColor: active ? palette.primary : colors.border,
                },
              ]}>
              <Text style={[styles.dayChipText, { color: active ? '#fff' : colors.text }]}>
                Últimos {d} días
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        {loading && !analytics && !overview ? (
          <ActivityIndicator style={styles.loading} color={palette.primary} />
        ) : error && !analytics && !overview ? (
          <View style={styles.centerBox}>
            <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
            <Pressable onPress={reload} style={[styles.outlineBtn, { borderColor: colors.border }]}>
              <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Tarjeta de Ventas Comerciales */}
            {overview && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="trending-up-outline" size={18} color={palette.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Desempeño de Ventas</Text>
                </View>

                <View style={styles.kpiGrid}>
                  <View style={[styles.kpiBox, { borderColor: colors.border }]}>
                    <Text style={[styles.small, { color: colors.muted }]}>Ventas hoy</Text>
                    <Text style={[styles.kpiValue, { color: '#16A34A' }]}>{formatGs(overview.sales.todayTotal)}</Text>
                    <Text style={[styles.tiny, { color: colors.muted }]}>{overview.sales.todayCount} tickets</Text>
                  </View>

                  <View style={[styles.kpiBox, { borderColor: colors.border }]}>
                    <Text style={[styles.small, { color: colors.muted }]}>Mes acumulado</Text>
                    <Text style={[styles.kpiValue, { color: palette.primary }]}>
                      {formatGs(overview.sales.monthTotal)}
                    </Text>
                    <Text style={[styles.tiny, { color: colors.muted }]}>{overview.sales.monthCount} transacciones</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Tráfico del Sitio Web */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="globe-outline" size={18} color="#7C3AED" />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Tráfico de tu Tienda Online</Text>
              </View>

              {summary ? (
                <>
                  <View style={styles.kpiGrid}>
                    <View style={[styles.kpiBox, { borderColor: colors.border }]}>
                      <Ionicons name="people-outline" size={16} color={palette.primary} />
                      <Text style={[styles.kpiValue, { color: colors.text }]}>
                        {summary.uniqueVisitors?.toLocaleString() ?? 0}
                      </Text>
                      <Text style={[styles.tiny, { color: colors.muted }]}>Visitantes únicos</Text>
                    </View>

                    <View style={[styles.kpiBox, { borderColor: colors.border }]}>
                      <Ionicons name="eye-outline" size={16} color="#0284C7" />
                      <Text style={[styles.kpiValue, { color: colors.text }]}>
                        {summary.pageViews?.toLocaleString() ?? 0}
                      </Text>
                      <Text style={[styles.tiny, { color: colors.muted }]}>Páginas vistas</Text>
                    </View>

                    <View style={[styles.kpiBox, { borderColor: colors.border }]}>
                      <Ionicons name="time-outline" size={16} color="#D97706" />
                      <Text style={[styles.kpiValue, { color: colors.text }]}>
                        {summary.sessions?.toLocaleString() ?? 0}
                      </Text>
                      <Text style={[styles.tiny, { color: colors.muted }]}>Sesiones activas</Text>
                    </View>

                    <View style={[styles.kpiBox, { borderColor: colors.border }]}>
                      <Ionicons name="arrow-redo-outline" size={16} color="#16A34A" />
                      <Text style={[styles.kpiValue, { color: colors.text }]}>
                        {summary.bounceRate ? `${Math.round(summary.bounceRate)}%` : '0%'}
                      </Text>
                      <Text style={[styles.tiny, { color: colors.muted }]}>Rebote</Text>
                    </View>
                  </View>

                  {/* Páginas más visitadas */}
                  {summary.topPages && summary.topPages.length > 0 && (
                    <View style={styles.topPagesWrap}>
                      <Text style={[styles.subHeading, { color: colors.text }]}>Secciones más consultadas</Text>
                      {summary.topPages.slice(0, 5).map((page, index) => (
                        <View key={page.path || index} style={[styles.pageRow, { borderColor: colors.border }]}>
                          <Text numberOfLines={1} style={[styles.pagePath, { color: colors.text }]}>
                            {page.path === '/' ? '/ (Inicio de tienda)' : page.path}
                          </Text>
                          <Text style={[styles.pageViews, { color: palette.primary }]}>
                            {page.views} vistas
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyWrap}>
                  <Ionicons name="analytics-outline" size={32} color={colors.muted} />
                  <Text style={[styles.small, { color: colors.muted, textAlign: 'center' }]}>
                    Las métricas web se registran automáticamente cuando los clientes navegan en tu catálogo online.
                  </Text>
                </View>
              )}
            </View>

            {/* Acceso a Reportes Completos en Web */}
            <Pressable
              onPress={() => void openWeb('/admin/reports')}
              style={[styles.webReportBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.webIconWrap, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
                <Ionicons name="document-text-outline" size={20} color={palette.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.bold, { color: colors.text }]}>Informes y Reportes en detalle</Text>
                <Text style={[styles.tiny, { color: colors.muted }]}>
                  Exportar a Excel, PDF y ver gráficos avanzados en la web
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.muted} />
            </Pressable>
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
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dayChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dayChipText: { fontSize: 12, fontWeight: '700' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  loading: { paddingVertical: 40 },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  bold: { fontSize: 14, fontWeight: '800' },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  outlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiBox: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  kpiValue: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  topPagesWrap: { gap: 8, paddingTop: 4 },
  subHeading: { fontSize: 13, fontWeight: '800' },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  pagePath: { flex: 1, fontSize: 12, fontWeight: '600' },
  pageViews: { fontSize: 12, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  webReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  webIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
