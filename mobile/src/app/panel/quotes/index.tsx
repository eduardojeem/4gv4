import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import { fetchQuotes, formatQuoteAmount, quoteCode, quoteStatusLabel, type MobileQuote, type QuoteFilter, type QuoteStatus } from '@/lib/quotes';

const FILTERS: { key: QuoteFilter; label: string }[] = [
  { key: 'open', label: 'En curso' },
  { key: 'accepted', label: 'Aceptados' },
  { key: 'converted', label: 'Convertidos' },
  { key: 'closed', label: 'Cerrados' },
  { key: 'all', label: 'Todos' },
];

const STATUS_TONE: Record<QuoteStatus, string> = {
  draft: '#64748B', sent: '#2563EB', accepted: '#16A34A', rejected: '#DC2626', converted: '#7C3AED', cancelled: '#64748B',
};

export default function QuotesScreen() {
  const colors = usePalette();
  const { data: panel, findItem, loading: panelLoading } = usePanel();
  const [filter, setFilter] = useState<QuoteFilter>('open');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [quotes, setQuotes] = useState<MobileQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [branchId, setBranchId] = useState(() => getPrivateCacheContext().branchId);
  const requestKey = JSON.stringify([panel?.organization.id, panel?.organization.role, panel?.user.email, branchId, search, filter, attempt]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestScope = useListRequestScope(requestKey);
  const visibleQuotes = loadedKey === requestKey ? quotes : [];
  const visibleTotal = loadedKey === requestKey ? total : 0;
  const visibleAvailable = loadedKey === requestKey ? available : true;
  const isLoading = loading || loadedKey !== requestKey;

  useEffect(() => subscribePrivateCacheContext((next) => setBranchId(next.branchId)), []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    if (!panel || !findItem('quotes')) return () => { active = false; };
    queueMicrotask(() => { if (active) { setLoading(true); setLoadingMore(false); } });
    fetchQuotes({ page: 1, status: filter, query: search })
      .then((result) => {
        if (!active) return;
        setQuotes(result.quotes);
        setTotal(result.pagination.total);
        setAvailable(result.available);
        setLoadedKey(requestKey);
        setPage(1);
        setError(null);
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar los presupuestos.'); })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [panel, findItem, filter, search, attempt, requestKey]);

  const refresh = useCallback(() => { setRefreshing(true); setAttempt((value) => value + 1); }, []);

  const loadMore = () => {
    if (loading || loadingMore || visibleQuotes.length >= visibleTotal) return;
    const isCurrent = requestScope.capture();
    setLoadingMore(true);
    fetchQuotes({ page: page + 1, status: filter, query: search })
      .then((result) => {
        if (!isCurrent()) return;
        setQuotes((current) => [...current, ...result.quotes.filter((quote) => !current.some((item) => item.id === quote.id))]);
        setTotal(result.pagination.total);
        setLoadedKey(requestKey);
        setPage((current) => current + 1);
        setError(null);
      })
      .catch((err) => { if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.'); })
      .finally(() => { if (isCurrent()) setLoadingMore(false); });
  };

  if (panelLoading || !findItem('quotes')) return <PanelAccessState />;

  return (
    <FlatList
      data={visibleQuotes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>Presupuestos</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>{isLoading ? 'Cargando…' : `${visibleTotal} ${visibleTotal === 1 ? 'presupuesto' : 'presupuestos'}`}</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: `${palette.primary}16` }]}>
              <Ionicons name="document-text-outline" size={16} color={palette.primary} />
              <Text style={[styles.countText, { color: palette.primary }]}>{filter === 'open' ? 'En curso' : 'Consulta'}</Text>
            </View>
          </View>
          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={17} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="N.º o nombre del cliente" placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search" style={[styles.searchInput, { color: colors.text }]} accessibilityLabel="Buscar presupuestos" />
            {query ? <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda"><Ionicons name="close-circle" size={17} color={colors.muted} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((item) => {
              const selected = filter === item.key;
              return <Pressable key={item.key} onPress={() => setFilter(item.key)} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}14` : colors.card }]}><Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }]}>{item.label}</Text></Pressable>;
            })}
          </ScrollView>
          {!visibleAvailable ? <Text style={[styles.notice, { color: colors.muted }]}>Los presupuestos todavía no están habilitados para este comercio.</Text> : null}
          {error && visibleQuotes.length > 0 ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={isLoading ? <ActivityIndicator style={styles.empty} color={palette.primary} /> : (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="document-text-outline" size={30} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{error ? 'No se pudieron cargar' : search ? 'Sin resultados' : 'No hay presupuestos'}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{error ?? (search ? 'Probá con otro número o nombre.' : 'Los presupuestos nuevos aparecerán aquí.')}</Text>
          {error ? <Pressable onPress={refresh} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text></Pressable> : null}
        </View>
      )}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={palette.primary} /> : null}
      renderItem={({ item }) => <QuoteCard quote={item} colors={colors} />}
    />
  );
}

function QuoteCard({ quote, colors }: { quote: MobileQuote; colors: ReturnType<typeof usePalette> }) {
  const tone = STATUS_TONE[quote.status];
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.code, { color: colors.muted }]}>{quoteCode(quote.number)}</Text>
        <View style={[styles.status, { backgroundColor: `${tone}16` }]}><View style={[styles.dot, { backgroundColor: tone }]} /><Text style={[styles.statusText, { color: tone }]}>{quoteStatusLabel(quote.status)}</Text></View>
      </View>
      <Text numberOfLines={1} style={[styles.customer, { color: colors.text }]}>{quote.customer_name}</Text>
      <View style={styles.rowBetween}>
        <Text style={[styles.muted, { color: colors.muted }]}>{new Date(quote.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}{quote.valid_until ? ` · Vence ${new Date(`${quote.valid_until}T12:00:00`).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}` : ''}</Text>
        <Text style={[styles.amount, { color: colors.text }]}>{formatQuoteAmount(Number(quote.total) || 0, quote.currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  flex: { flex: 1 },
  header: { gap: 12, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800' },
  muted: { fontSize: 12 },
  countBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  countText: { fontSize: 12, fontWeight: '700' },
  search: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14 },
  chips: { gap: 8, paddingRight: 16 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  notice: { fontSize: 12 },
  error: { color: palette.danger, fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  code: { fontSize: 12, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  customer: { fontSize: 16, fontWeight: '700' },
  amount: { fontSize: 13, fontWeight: '800' },
  empty: { marginTop: 28 },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 22, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  retry: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 4 },
  footer: { paddingVertical: 20 },
});
