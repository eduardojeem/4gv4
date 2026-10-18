import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CollectSheet } from '@/components/collect-sheet';
import { creditCode, dateOnly, fetchPortfolio, type InstallmentRow, type PortfolioCredit, type PortfolioStatus, type PortfolioSummary } from '@/lib/customers';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;
type Row = InstallmentRow & { credit?: PortfolioCredit };

const FILTERS: { key: PortfolioStatus; label: string }[] = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'late', label: 'Vencidas' },
  { key: 'paid', label: 'Pagadas' },
  { key: '', label: 'Todas' },
];

/** Cartera de créditos, como /dashboard/credits: KPIs, cuotas por vencimiento y cobro. */
export default function CreditsScreen() {
  const colors = usePalette();
  const { data: panelData, findItem, loading: panelLoading } = usePanel();
  const [status, setStatus] = useState<PortfolioStatus>('pending');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [collect, setCollect] = useState<Row | null>(null);

  const requestScope = useListRequestScope(JSON.stringify([panelData?.organization.id, panelData?.organization.role, panelData?.user.email,search,status,attempt]));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    if (!panelData || !findItem('credits')) return () => { active = false; };
    queueMicrotask(() => { if (active) { setLoading(true); setLoadingMore(false); } });
    fetchPortfolio({ status, page: 1, customerName: search })
      .then((data) => {
        if (!active) return;
        const credits = new Map(data.credits.map((credit) => [credit.id, credit]));
        setRows(data.installments.map((row) => ({ ...row, credit: credits.get(row.credit_id) })));
        setSummary(data.globalSummary);
        setTotal(data.pagination.total);
        setPage(1);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar la cartera.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [status, search, attempt, panelData, findItem]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || rows.length >= total) return;
    const isCurrent = requestScope.capture();
    setLoadingMore(true);
    fetchPortfolio({ status, page: page + 1, customerName: search })
      .then((data) => {
        if (!isCurrent()) return;
        setError(null);
        const credits = new Map(data.credits.map((credit) => [credit.id, credit]));
        setRows((list) => [...list, ...data.installments.filter((row) => !list.some((item) => item.id === row.id)).map((row) => ({ ...row, credit: credits.get(row.credit_id) }))]);
        setPage(page + 1);
      })
      .catch((err) => { if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.'); })
      .finally(() => { if (isCurrent()) setLoadingMore(false); });
  };

  if (panelLoading || !findItem('credits')) return <PanelAccessState />;

  return (
    <View style={styles.flex}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Créditos</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>
                {summary ? `${summary.distinctCustomers} clientes · ${summary.pendingCount} cuotas pendientes` : 'Cargando…'}
              </Text>
            </View>
            <View style={styles.kpis}>
              <Kpi label="Por cobrar" value={summary ? formatGs(summary.outstanding) : '…'} colors={colors} />
              <Kpi label="Vencido" value={summary ? formatGs(summary.overdue) : '…'} tone={summary?.overdue ? palette.danger : undefined} hint={summary?.overdueCount ? `${summary.overdueCount} cuotas` : undefined} colors={colors} />
              <Kpi label="Vence hoy" value={summary ? formatGs(summary.dueToday) : '…'} tone={summary?.dueToday ? '#D97706' : undefined} colors={colors} />
              <Kpi label="Recuperación" value={summary ? `${Math.round(summary.recoveryRate)}%` : '…'} tone={palette.success} hint={summary ? `Cobrado ${formatGs(summary.paid)}` : undefined} colors={colors} />
            </View>
            <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={17} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Buscar por cliente" placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((item) => {
                const selected = status === item.key;
                return (
                  <Pressable
                    key={item.label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setStatus(item.key);
                    }}
                    style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? palette.primary : colors.card }]}>
                    <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {!loading && <Text style={[styles.small, { color: colors.muted }]}>{total} cuotas</Text>}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{error ?? (status === 'late' ? 'No hay cuotas vencidas 🎉' : 'No hay cuotas')}</Text>
              {error && (
                <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                  <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ListFooterComponent={<View>{error && <Text accessibilityRole="alert" style={{ color: palette.danger, padding: 12 }}>{error}</Text>}{loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}</View>}
        renderItem={({ item }) => <InstallmentItem row={item} colors={colors} onCollect={() => setCollect(item)} />}
      />

      {collect?.credit && (
        <CollectSheet
          customerId={collect.credit.customer_id}
          customerName={collect.credit.customer_name ?? 'Cliente'}
          focusDebtId={collect.id}
          onClose={() => setCollect(null)}
          onDone={() => {
            setCollect(null);
            reload();
          }}
        />
      )}
    </View>
  );
}

function InstallmentItem({ row, colors, onCollect }: { row: Row; colors: Colors; onCollect: () => void }) {
  const paid = row.status === 'paid';
  const late = row.status === 'late';
  const rest = Math.max(0, Number(row.amount) - Number(row.amount_paid ?? 0));
  const color = paid ? palette.success : late ? palette.danger : colors.muted;
  const credit = row.credit;
  return (
    <Pressable
      onPress={() => credit && router.push(`/panel/customers/${credit.customer_id}?tab=credits` as never)}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: late ? '#DC262655' : colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={paid ? 'checkmark' : late ? 'alert' : 'time-outline'} size={18} color={color} />
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{credit?.customer_name ?? 'Cliente'}</Text>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
          {credit ? creditCode(credit) : '—'} · cuota {row.installment_number}
          {credit?.term_months ? `/${credit.term_months}` : ''}
        </Text>
        <Text style={[styles.small, { color, fontWeight: '700' }]}>
          {paid ? `Pagada${row.paid_at ? ` ${dateOnly(row.paid_at)}` : ''}` : `${late ? 'Venció' : 'Vence'} ${dateOnly(row.due_date)}`}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.name, { color: paid ? colors.muted : colors.text }]}>{formatGs(paid ? Number(row.amount) : rest)}</Text>
        {!paid && credit && (
          <Pressable onPress={onCollect} hitSlop={6} style={styles.collect}>
            <Text style={styles.collectText}>Cobrar</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function Kpi({ label, value, hint, tone, colors }: { label: string; value: string; hint?: string; tone?: string; colors: Colors }) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.tiny, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: tone ?? colors.text }]}>{value}</Text>
      {hint ? <Text style={[styles.tiny, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13 },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '700' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  loading: { paddingVertical: 40 },
  more: { paddingVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '800' },
  right: { alignItems: 'flex-end', gap: 6 },
  collect: { backgroundColor: palette.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  collectText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
