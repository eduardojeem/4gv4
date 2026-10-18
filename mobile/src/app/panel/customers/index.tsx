import { PanelAccessState } from '@/components/panel-access-state';
import { useListRequestScope } from '@/lib/use-list-request-scope';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchCustomers, isWholesale, type Customer, type CustomerFilter } from '@/lib/customers';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;

const FILTERS: { key: CustomerFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todos', icon: 'people-outline' },
  { key: 'debt', label: 'Con deuda', icon: 'alert-circle-outline' },
  { key: 'wholesale', label: 'Mayoristas', icon: 'briefcase-outline' },
  { key: 'empresa', label: 'Empresas', icon: 'business-outline' },
  { key: 'inactive', label: 'Inactivos', icon: 'eye-off-outline' },
];

/** Clientes, como /dashboard/customers: buscar, filtrar, crear y abrir la ficha. */
export default function CustomersScreen() {
  const colors = usePalette();
  const { data: panelData, findItem, can, loading: panelLoading } = usePanel();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [rows, setRows] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<{ total: number; active: number } | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const requestScope = useListRequestScope(JSON.stringify([panelData?.organization.id, panelData?.organization.role, panelData?.user.email,search,filter,attempt]));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    if (!panelData || !findItem('customers')) return () => { active = false; };
    queueMicrotask(() => { if (active) { setLoading(true); setLoadingMore(false); } });
    fetchCustomers({ search, filter, page: 1 })
      .then((result) => {
        if (!active) return;
        setRows(result.data ?? []);
        if (result.summary) setSummary(result.summary);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
        setPage(1);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.'))
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [search, filter, attempt, panelData, findItem]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    const isCurrent = requestScope.capture();
    setLoadingMore(true);
    fetchCustomers({ search, filter, page: page + 1 })
      .then((result) => {
        if (!isCurrent()) return;
        setError(null);
        setRows((list) => [...list, ...(result.data ?? []).filter((row) => !list.some((item) => item.id === row.id))]);
        setPage(page + 1);
      })
      .catch((err) => { if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.'); })
      .finally(() => { if (isCurrent()) setLoadingMore(false); });
  };

  if (panelLoading || !findItem('customers')) return <PanelAccessState />;

  return (
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
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>Clientes</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>
                {summary ? `${summary.total.toLocaleString('es-PY')} clientes · ${summary.active.toLocaleString('es-PY')} activos` : 'Cargando…'}
              </Text>
            </View>
            {findItem('credits') && (
              <Pressable onPress={() => router.push('/panel/credits' as never)} style={[styles.iconBtn, { borderColor: colors.border }]} accessibilityLabel="Créditos">
                <Ionicons name="wallet-outline" size={19} color={colors.text} />
              </Pressable>
            )}
            <Pressable disabled={!can('crm.customers.manage') && !can('pos.sales.create')} onPress={() => router.push('/panel/customers/form' as never)} style={[styles.newBtn,{opacity:can('crm.customers.manage')||can('pos.sales.create')?1:0.4}]}>
              <Ionicons name="person-add-outline" size={18} color="#fff" />
              <Text style={styles.newText}>Nuevo</Text>
            </Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={17} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Nombre, CI/RUC, teléfono, email o código" placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((item) => {
              const selected = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setFilter(item.key);
                  }}
                  style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? palette.primary : colors.card }]}>
                  <Ionicons name={item.icon} size={14} color={selected ? '#fff' : colors.muted} />
                  <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {!loading && (search || filter !== 'all') && <Text style={[styles.small, { color: colors.muted }]}>{total} resultados</Text>}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={styles.loading} color={palette.primary} />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={36} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{error ?? (search ? 'Sin resultados' : 'No hay clientes')}</Text>
            {error ? (
              <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
              </Pressable>
            ) : search ? (
              <Pressable onPress={() => router.push(`/panel/customers/form?name=${encodeURIComponent(search)}` as never)} style={[styles.outline, { borderColor: palette.primary }]}>
                <Text style={{ color: palette.primary, fontWeight: '800' }}>Crear «{search}»</Text>
              </Pressable>
            ) : null}
          </View>
        )
      }
      ListFooterComponent={<View>{error && <Text accessibilityRole="alert" style={{ color: palette.danger, padding: 12 }}>{error}</Text>}{loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}</View>}
      renderItem={({ item }) => <CustomerRow customer={item} colors={colors} />}
    />
  );
}

function CustomerRow({ customer, colors }: { customer: Customer; colors: Colors }) {
  const details = [customer.ruc ? `CI ${customer.ruc}` : null, customer.phone, customer.city].filter(Boolean).join(' · ');
  const inactive = customer.status === 'inactive';
  return (
    <Pressable
      onPress={() => router.push(`/panel/customers/${customer.id}` as never)}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : inactive ? 0.55 : 1 }]}>
      <View style={[styles.avatar, { backgroundColor: isWholesale(customer) ? '#7C3AED1A' : 'rgba(37,99,235,0.1)' }]}>
        <Text style={[styles.avatarText, { color: isWholesale(customer) ? '#7C3AED' : palette.primary }]}>{customer.name.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{customer.name}</Text>
          {isWholesale(customer) && <Tag label="Mayorista" color="#7C3AED" />}
          {customer.customer_type === 'empresa' && <Tag label="Empresa" color="#0891B2" />}
        </View>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>{details || customer.customer_code || 'Sin datos de contacto'}</Text>
      </View>
      {Number(customer.lifetime_value) > 0 && <Text style={[styles.small, { color: colors.muted }]}>{formatGs(Number(customer.lifetime_value))}</Text>}
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13 },
  small: { fontSize: 12 },
  iconBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, height: 42 },
  newText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  loading: { paddingVertical: 40 },
  more: { paddingVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
