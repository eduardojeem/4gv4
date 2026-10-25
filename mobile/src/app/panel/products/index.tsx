import { getPrivateCacheContext, isPrivateCacheSnapshotCompatible, isPrivateIdentityTransition, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  fetchCategories,
  fetchProducts,
  hasActiveOffer,
  onProductChanged,
  productImages,
  rememberProducts,
  stockState,
  type Category,
  type Product,
  type ProductSort,
  type StockFilter,
} from '@/lib/products';

type Colors = ReturnType<typeof usePalette>;

type QuickFilter = 'all' | 'low' | 'out' | 'offers' | 'services' | 'inactive';

const FILTERS: { key: QuickFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todos', icon: 'apps-outline' },
  { key: 'low', label: 'Bajo stock', icon: 'alert-circle-outline' },
  { key: 'out', label: 'Sin stock', icon: 'close-circle-outline' },
  { key: 'offers', label: 'En oferta', icon: 'pricetag-outline' },
  { key: 'services', label: 'Servicios', icon: 'construct-outline' },
  { key: 'inactive', label: 'Inactivos', icon: 'eye-off-outline' },
];

const SORTS: { key: ProductSort; label: string }[] = [
  { key: 'name', label: 'A-Z' },
  { key: 'created_at', label: 'Recientes' },
  { key: 'price', label: 'Precio' },
  { key: 'stock', label: 'Stock' },
];

const STOCK_FOR: Partial<Record<QuickFilter, StockFilter>> = { low: 'low_stock', out: 'out_of_stock' };

export default function ProductsScreen() {
  const colors = usePalette();
  const { data: panelData, findItem, can, loading: panelLoading } = usePanel();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');
  // Desde «Categorías» se llega con ?category=: la lista abre filtrada.
  const { category: initialCategory } = useLocalSearchParams<{ category?: string }>();
  const [categoryId, setCategoryId] = useState<string | null>(initialCategory || null);
  const [sort, setSort] = useState<ProductSort>('name');
  const [grid, setGrid] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [scanning, setScanning] = useState(false);

  const requestScope = useListRequestScope(JSON.stringify([panelData?.organization.id, panelData?.organization.role, panelData?.user.email,search,categoryId,filter,sort,attempt]));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    fetchCategories()
      .then((rows) => setCategories(rows.filter((row) => !row.parent_id).sort((a, b) => (b.products_count ?? 0) - (a.products_count ?? 0))))
      .catch(() => setCategories([]));
  }, []);

  const params = useCallback(
    (nextPage: number) => ({
      query: search,
      categoryId,
      stock: STOCK_FOR[filter] ?? 'all',
      offers: filter === 'offers',
      services: filter === 'services',
      inactive: filter === 'inactive',
      sort,
      page: nextPage,
    }),
    [search, categoryId, filter, sort]
  );

  useEffect(() => {
    let active = true;
    if (!panelData || !findItem('products')) return () => { active = false; };
    queueMicrotask(() => { if (active) { setLoading(true); setLoadingMore(false); } });
    const privateScope = getPrivateCacheContext();
    fetchProducts(params(1))
      .then((result) => {
        if (!active || !isPrivateCacheSnapshotCompatible(privateScope)) return;
        rememberProducts(result.products, privateScope);
        setProducts(result.products);
        setTotal(result.total);
        setTruncated(Boolean(result.truncated));
        setPage(1);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar los productos.'))
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [params, attempt, panelData, findItem]);

  // Solo otro usuario, otro comercio, otra sucursal o un acceso revocado vacían la lista;
  // terminar de resolver el comercio al abrir la app no.
  useEffect(() => subscribePrivateCacheContext((next, previous) => {
    if (!isPrivateIdentityTransition(next, previous)) return;
    setProducts([]); setTotal(0); setError('El contexto cambió. Actualizá el catálogo.');
  }), []);

  // Lo que se edita o borra en el detalle se refleja al volver.
  useEffect(
    () =>
      onProductChanged((change) => {
        if ('deleted' in change) {
          setProducts((list) => list.filter((product) => product.id !== change.id));
          setTotal((count) => Math.max(0, count - 1));
        } else {
          setProducts((list) => (list.some((product) => product.id === change.id) ? list.map((product) => (product.id === change.id ? change : product)) : [change, ...list]));
        }
      }),
    []
  );

  const reload = () => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  };

  const change = (apply: () => void) => {
    apply();
  };

  const loadMore = () => {
    if (loadingMore || loading || products.length >= total) return;
    const isCurrentRequest = requestScope.capture();
    const privateScope = getPrivateCacheContext();
    const isCurrent = () => isCurrentRequest() && isPrivateCacheSnapshotCompatible(privateScope);
    setLoadingMore(true);
    fetchProducts(params(page + 1))
      .then((result) => {
        if (!isCurrent()) return;
        setError(null);
        rememberProducts(result.products, privateScope);
        setProducts((list) => [...list, ...result.products.filter((item) => !list.some((existing) => existing.id === item.id))]);
        setPage(page + 1);
      })
      .catch((err) => { if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.'); })
      .finally(() => { if (isCurrent()) setLoadingMore(false); });
  };

  // Escanear: si el código es de un producto, se abre; si no, queda como búsqueda.
  const onScanned = async (code: string) => {
    setScanning(false);
    setQuery(code);
    try {
      const result = await fetchProducts({ query: code, page: 1 });
      const exact = result.products.find((product) => product.barcode === code || product.sku === code);
      if (exact) {
        rememberProducts([exact]);
        router.push(`/panel/products/${exact.id}` as never);
      }
    } catch {
      // Queda la búsqueda escrita: la lista muestra el resultado o «sin resultados».
    }
  };

  if (panelLoading || !findItem('products')) return <PanelAccessState />;

  const header = (
    <View style={styles.headerWrap}>
      {truncated && <Text accessibilityRole="alert" style={{color:palette.danger}}>El listado y total son parciales. Afiná la búsqueda para ver todos los resultados.</Text>}
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>Productos</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{loading ? 'Cargando…' : `${total.toLocaleString('es-PY')} ${total === 1 ? 'producto' : 'productos'}`}</Text>
        </View>
        <Pressable onPress={() => setGrid((value) => !value)} style={[styles.iconBtn, { borderColor: colors.border }]} accessibilityLabel={grid ? 'Ver como lista' : 'Ver como grilla'}>
          <Ionicons name={grid ? 'list-outline' : 'grid-outline'} size={19} color={colors.text} />
        </Pressable>
        <Pressable disabled={!can('products.create')} accessibilityState={{ disabled: !can('products.create') }} onPress={() => router.push('/panel/products/form' as never)} style={[styles.newBtn, {opacity:can('products.create')?1:0.4}]} accessibilityRole="button">
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newText}>Nuevo</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nombre, SKU, marca o código"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar productos"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => setScanning(true)} style={[styles.scanBtn, { backgroundColor: colors.text }]} accessibilityLabel="Escanear código de barras">
          <Ionicons name="barcode-outline" size={22} color={colors.background} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((item) => {
          const selected = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => change(() => setFilter(item.key))}
              style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? palette.primary : colors.card }]}>
              <Ionicons name={item.icon} size={14} color={selected ? '#fff' : colors.muted} />
              <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => change(() => setCategoryId(null))} style={[styles.catChip, { borderColor: !categoryId ? palette.primary : colors.border }]}>
            <Text style={[styles.catText, { color: !categoryId ? palette.primary : colors.text }]}>Todas las categorías</Text>
          </Pressable>
          {categories.map((category) => {
            const selected = categoryId === category.id;
            return (
              <Pressable key={category.id} onPress={() => change(() => setCategoryId(selected ? null : category.id))} style={[styles.catChip, { borderColor: selected ? palette.primary : colors.border }]}>
                <Text style={[styles.catText, { color: selected ? palette.primary : colors.text }]}>{category.name}</Text>
                {category.products_count ? <Text style={[styles.catCount, { color: colors.muted }]}>{category.products_count}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.sortRow}>
        <Ionicons name="swap-vertical" size={14} color={colors.muted} />
        {SORTS.map((item) => (
          <Pressable key={item.key} onPress={() => change(() => setSort(item.key))} hitSlop={6}>
            <Text style={[styles.sortText, { color: sort === item.key ? palette.primary : colors.muted }, sort === item.key && styles.bold]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.flex}>
      {loading && products.length === 0 ? (
        <>
          {header}
          <View style={styles.center}>
            <ActivityIndicator color={palette.primary} />
          </View>
        </>
      ) : error && products.length === 0 ? (
        <>
          {header}
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={30} color={colors.muted} />
            <Text style={[styles.muted, { color: colors.muted }]}>{error}</Text>
            <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <FlatList
          key={grid ? 'grid' : 'list'}
          data={products}
          numColumns={grid ? 2 : 1}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          columnWrapperStyle={grid ? styles.gridRow : undefined}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{search ? 'Sin resultados' : 'No hay productos'}</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>{search ? `Nada coincide con «${search}».` : 'Cargá el primero con «Nuevo».'}</Text>
              {search ? (
                <Pressable disabled={!can('products.create')} onPress={() => router.push(`/panel/products/form?barcode=${encodeURIComponent(/^\d{6,}$/.test(search) ? search : '')}&name=${encodeURIComponent(/^\d{6,}$/.test(search) ? '' : search)}` as never)} style={[styles.outline, { borderColor: palette.primary }]}>
                  <Text style={{ color: palette.primary, fontWeight: '800' }}>Crear «{search}»</Text>
                </Pressable>
              ) : null}
            </View>
          }
          ListFooterComponent={<View>{error && <Text accessibilityRole="alert" style={{ color: palette.danger, padding: 12 }}>{error}</Text>}{loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}</View>}
          renderItem={({ item }) => (grid ? <GridCard product={item} colors={colors} /> : <ListRow product={item} colors={colors} />)}
        />
      )}

      <BarcodeScanner visible={scanning} onClose={() => setScanning(false)} onScanned={onScanned} title="Buscar por código" />
    </View>
  );
}

function Price({ product, colors, large }: { product: Product; colors: Colors; large?: boolean }) {
  if (hasActiveOffer(product)) {
    return (
      <View>
        <Text style={[styles.oldPrice, { color: colors.muted }]}>{formatGs(product.sale_price)}</Text>
        <Text style={[large ? styles.priceLg : styles.price, { color: '#DC2626' }]}>{formatGs(product.offer_price!)}</Text>
      </View>
    );
  }
  return <Text style={[large ? styles.priceLg : styles.price, { color: colors.text }]}>{formatGs(product.sale_price)}</Text>;
}

function Thumb({ product, colors, size }: { product: Product; colors: Colors; size?: number }) {
  const image = productImages(product)[0];
  return (
    <View style={[styles.thumb, size ? { width: size, height: size } : styles.thumbFull, { backgroundColor: colors.background }]}>
      {image ? <Image source={image} style={styles.fill} contentFit="cover" transition={150} /> : <Ionicons name="image-outline" size={size ? 22 : 30} color={colors.muted} />}
    </View>
  );
}

function GridCard({ product, colors }: { product: Product; colors: Colors }) {
  const stock = stockState(product);
  return (
    <Pressable
      onPress={() => router.push(`/panel/products/${product.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatGs(product.sale_price)}, ${stock.label}`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : product.is_active ? 1 : 0.6 }]}>
      <View>
        <Thumb product={product} colors={colors} />
        {hasActiveOffer(product) && (
          <View style={styles.offerBadge}>
            <Text style={styles.offerText}>-{Math.round((1 - product.offer_price! / product.sale_price) * 100)}%</Text>
          </View>
        )}
        <View style={[styles.stockBadge, { backgroundColor: `${stock.color}E6` }]}>
          <Text style={styles.stockText}>{stock.label}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>{product.name}</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>{[product.brand, product.sku].filter(Boolean).join(' · ')}</Text>
        <Price product={product} colors={colors} />
        {!product.is_active && <Text style={[styles.meta, { color: palette.danger }]}>Inactivo</Text>}
      </View>
    </Pressable>
  );
}

function ListRow({ product, colors }: { product: Product; colors: Colors }) {
  const stock = stockState(product);
  return (
    <Pressable
      onPress={() => router.push(`/panel/products/${product.id}` as never)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : product.is_active ? 1 : 0.6 }]}>
      <Thumb product={product} colors={colors} size={62} />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{product.name}</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>
          {[product.sku, product.category?.name, product.brand].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.rowFoot}>
          <Price product={product} colors={colors} />
          <View style={[styles.pill, { backgroundColor: `${stock.color}1A` }]}>
            <Text style={[styles.pillText, { color: stock.color }]}>{stock.label}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  bold: { fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  headerWrap: { gap: 10, paddingBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13, textAlign: 'center' },
  iconBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, height: 42 },
  newText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  scanBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  catText: { fontSize: 12, fontWeight: '700' },
  catCount: { fontSize: 11 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sortText: { fontSize: 13 },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },
  gridRow: { gap: 12 },
  more: { paddingVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  card: { flex: 1, borderWidth: 1, borderRadius: 16, overflow: 'hidden', maxWidth: '49%' },
  thumb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12 },
  thumbFull: { width: '100%', aspectRatio: 1, borderRadius: 0 },
  offerBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#DC2626', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  offerText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  stockBadge: { position: 'absolute', bottom: 8, left: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  stockText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cardBody: { padding: 10, gap: 3 },
  name: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  meta: { fontSize: 11 },
  price: { fontSize: 15, fontWeight: '900' },
  priceLg: { fontSize: 18, fontWeight: '900' },
  oldPrice: { fontSize: 11, textDecorationLine: 'line-through' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  rowFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '800' },
});
