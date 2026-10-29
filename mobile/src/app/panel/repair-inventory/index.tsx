import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import { fetchProducts, type Product, type ProductSort, type StockFilter } from '@/lib/products';

const FILTERS: { key: StockFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'low_stock', label: 'Bajo mínimo' },
  { key: 'out_of_stock', label: 'Sin stock' },
];
const STOCK_WARNING = '#D97706';

export default function RepairInventoryScreen() {
  const colors = usePalette();
  const { data: panel, findItem, loading: panelLoading } = usePanel();
  const [filter, setFilter] = useState<StockFilter>('low_stock');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [branchId, setBranchId] = useState(() => getPrivateCacheContext().branchId);
  const requestKey = JSON.stringify([panel?.organization.id, panel?.organization.role, panel?.user.email, branchId, search, filter, attempt]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestScope = useListRequestScope(requestKey);
  const visibleProducts = loadedKey === requestKey ? products : [];
  const visibleTotal = loadedKey === requestKey ? total : 0;
  const isLoading = loading || loadedKey !== requestKey;

  useEffect(() => subscribePrivateCacheContext((next) => setBranchId(next.branchId)), []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    if (!panel || !findItem('repair-inventory')) return () => { active = false; };
    queueMicrotask(() => { if (active) { setLoading(true); setLoadingMore(false); } });
    fetchProducts({ page: 1, query: search, stock: filter, catalogKind: 'physical', sort: 'name' as ProductSort })
      .then((result) => {
        if (!active) return;
        setProducts(result.products);
        setTotal(result.total);
        setLoadedKey(requestKey);
        setPage(1);
        setError(null);
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el inventario del taller.'); })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [panel, findItem, search, filter, attempt, requestKey]);

  const refresh = useCallback(() => { setRefreshing(true); setAttempt((value) => value + 1); }, []);
  const loadMore = () => {
    if (loading || loadingMore || visibleProducts.length >= visibleTotal) return;
    const isCurrent = requestScope.capture();
    setLoadingMore(true);
    fetchProducts({ page: page + 1, query: search, stock: filter, catalogKind: 'physical', sort: 'name' })
      .then((result) => {
        if (!isCurrent()) return;
        setProducts((current) => [...current, ...result.products.filter((product) => !current.some((item) => item.id === product.id))]);
        setTotal(result.total);
        setLoadedKey(requestKey);
        setPage((current) => current + 1);
      })
      .catch((err) => { if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.'); })
      .finally(() => { if (isCurrent()) setLoadingMore(false); });
  };

  if (panelLoading || !findItem('repair-inventory')) return <PanelAccessState />;

  return (
    <FlatList
      data={visibleProducts}
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
              <Text style={[styles.title, { color: colors.text }]}>Inventario del taller</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>{isLoading ? 'Cargando…' : `${visibleTotal} ${visibleTotal === 1 ? 'artículo' : 'artículos'} en esta sucursal`}</Text>
            </View>
            <View style={[styles.stockBadge, { backgroundColor: `${STOCK_WARNING}18` }]}>
              <Ionicons name="alert-circle-outline" size={17} color={STOCK_WARNING} />
            </View>
          </View>
          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={17} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Buscar repuesto o SKU" placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search" style={[styles.searchInput, { color: colors.text }]} accessibilityLabel="Buscar en inventario del taller" />
            {query ? <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda"><Ionicons name="close-circle" size={17} color={colors.muted} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((item) => {
              const selected = filter === item.key;
              return <Pressable key={item.key} onPress={() => setFilter(item.key)} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.filter, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}14` : colors.card }]}><Text style={[styles.filterText, { color: selected ? palette.primary : colors.text }]}>{item.label}</Text></Pressable>;
            })}
          </ScrollView>
          {error && visibleProducts.length > 0 ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={isLoading ? <ActivityIndicator style={styles.empty} color={palette.primary} /> : (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name={filter === 'all' ? 'file-tray-stacked-outline' : 'checkmark-circle-outline'} size={30} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{error ? 'No se pudo cargar el inventario' : search ? 'Sin resultados' : filter === 'all' ? 'Inventario vacío' : 'Sin alertas de stock'}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{error ?? (search ? 'Probá con otro nombre o SKU.' : filter === 'all' ? 'No hay artículos físicos activos en esta sucursal.' : 'Los repuestos están por encima de su mínimo.')}</Text>
          {error ? <Pressable onPress={refresh} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text></Pressable> : null}
        </View>
      )}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={palette.primary} /> : null}
      renderItem={({ item }) => <InventoryCard product={item} colors={colors} />}
    />
  );
}

function InventoryCard({ product, colors }: { product: Product; colors: ReturnType<typeof usePalette> }) {
  const summary = product.variant_stock_summary;
  const hasVariants = Boolean(product.has_variants || summary?.variant_count);
  const stock = Number(product.branch_stock_quantity ?? product.stock_quantity ?? 0);
  const minimum = Number(product.min_stock ?? 0);
  const noStock = stock <= 0 || Boolean(summary && summary.total_stock <= 0);
  const tone = noStock ? palette.danger : STOCK_WARNING;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.itemIcon, { backgroundColor: `${tone}16` }]}><Ionicons name="hardware-chip-outline" size={18} color={tone} /></View>
        <View style={styles.flex}>
          <Text numberOfLines={2} style={[styles.itemName, { color: colors.text }]}>{product.name}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{product.sku ? `SKU ${product.sku}` : 'Sin SKU'}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: `${tone}16` }]}>
          <Text style={[styles.statusText, { color: tone }]}>{noStock ? 'Sin stock' : 'Bajo mínimo'}</Text>
        </View>
      </View>
      {hasVariants ? (
        <View style={[styles.stockSummary, { borderColor: colors.border }]}>
          <Text style={[styles.stockText, { color: colors.text }]}>{Number(summary?.total_stock ?? stock)} unidades entre variantes</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{Number(summary?.out_of_stock_variant_count ?? 0)} sin stock · {Number(summary?.low_stock_variant_count ?? 0)} bajo mínimo</Text>
        </View>
      ) : (
        <View style={[styles.stockSummary, { borderColor: colors.border }]}>
          <Text style={[styles.stockText, { color: colors.text }]}>Disponible: {stock}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>Mínimo: {minimum}</Text>
        </View>
      )}
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
  stockBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14 },
  filters: { gap: 8, paddingRight: 16 },
  filter: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { fontSize: 12, fontWeight: '700' },
  error: { color: palette.danger, fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '700' },
  status: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '700' },
  stockSummary: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stockText: { fontSize: 12, fontWeight: '700' },
  empty: { marginTop: 28 },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 22, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  retry: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 4 },
  footer: { paddingVertical: 20 },
});
