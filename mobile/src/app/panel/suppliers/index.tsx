import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { deleteSupplier, fetchSuppliers, isActiveSupplier, rememberSuppliers, updateSupplier, type Supplier, type SupplierFilter } from '@/lib/suppliers';

type Colors = ReturnType<typeof usePalette>;

const FILTERS: { key: SupplierFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'inactive', label: 'Inactivos' },
];

const waNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `595${digits.slice(1)}` : digits;
};

/** Proveedores, como /dashboard/suppliers: buscar, ver, contactar, crear, editar y desactivar. */
export default function SuppliersScreen() {
  const colors = usePalette();
  const { findItem, loading: panelLoading } = usePanel();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SupplierFilter>('all');
  const [rows, setRows] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Supplier | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    fetchSuppliers({ search, filter, page: 0 })
      .then((result) => {
        if (!active) return;
        rememberSuppliers(result.rows);
        setRows(result.rows);
        setTotal(result.total);
        setPage(0);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [search, filter, attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || rows.length >= total) return;
    setLoadingMore(true);
    fetchSuppliers({ search, filter, page: page + 1 })
      .then((result) => {
        rememberSuppliers(result.rows);
        setRows((list) => [...list, ...result.rows.filter((row) => !list.some((item) => item.id === row.id))]);
        setPage(page + 1);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  };

  if (!panelLoading && !findItem('suppliers')) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.muted} />
        <Text style={[styles.title, { color: colors.text }]}>Proveedores no disponible</Text>
      </View>
    );
  }

  const debt = rows.reduce((sum, row) => sum + (Number(row.current_debt) || 0), 0);

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
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]}>Proveedores</Text>
                <Text style={[styles.muted, { color: colors.muted }]}>
                  {loading ? 'Cargando…' : `${total} proveedores${debt > 0 ? ` · deuda ${formatGs(debt)}` : ''}`}
                </Text>
              </View>
              <Pressable onPress={() => router.push('/panel/suppliers/form' as never)} style={styles.newBtn}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.newText}>Nuevo</Text>
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={17} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Nombre, contacto o email" placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((item) => {
                const isSelected = filter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setLoading(true);
                      setFilter(item.key);
                    }}
                    style={[styles.chip, { borderColor: isSelected ? palette.primary : colors.border, backgroundColor: isSelected ? palette.primary : colors.card }]}>
                    <Text style={[styles.chipText, { color: isSelected ? '#fff' : colors.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{error ?? (search ? 'Sin resultados' : 'Todavía no hay proveedores')}</Text>
              {error ? (
                <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                  <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => router.push(`/panel/suppliers/form${search ? `?name=${encodeURIComponent(search)}` : ''}` as never)} style={[styles.outline, { borderColor: palette.primary }]}>
                  <Text style={[styles.bold, { color: palette.primary }]}>{search ? `Crear «${search}»` : 'Agregar el primero'}</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}
        renderItem={({ item }) => <SupplierRow supplier={item} colors={colors} onPress={() => setSelected(item)} />}
      />

      {selected && (
        <SupplierSheet
          supplier={selected}
          colors={colors}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </View>
  );
}

function SupplierRow({ supplier, colors, onPress }: { supplier: Supplier; colors: Colors; onPress: () => void }) {
  const active = isActiveSupplier(supplier);
  const details = [supplier.contact_name, supplier.phone, supplier.city].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : active ? 1 : 0.55 }]}>
      <View style={[styles.avatar, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
        <Text style={[styles.avatarText, { color: palette.primary }]}>{supplier.name.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{supplier.name}</Text>
          {!active && <Tag label="Inactivo" color="#64748B" />}
        </View>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>{details || supplier.category || 'Sin datos de contacto'}</Text>
      </View>
      <View style={styles.right}>
        {Number(supplier.current_debt) > 0 && <Text style={[styles.small, styles.debt]}>{formatGs(Number(supplier.current_debt))}</Text>}
        <Text style={[styles.tiny, { color: colors.muted }]}>{supplier.productCount ?? 0} productos</Text>
      </View>
    </Pressable>
  );
}

function SupplierSheet({ supplier, colors, onClose, onChanged }: { supplier: Supplier; colors: Colors; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const active = isActiveSupplier(supplier);
  const phone = supplier.phone?.trim();

  const toggle = () => {
    setBusy(true);
    updateSupplier(supplier.id, { is_active: !active })
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onChanged();
      })
      .catch((err) => Alert.alert('No se guardó', err instanceof Error ? err.message : 'Intentá de nuevo.'))
      .finally(() => setBusy(false));
  };

  const remove = () =>
    Alert.alert('Eliminar proveedor', `¿Eliminar a ${supplier.name}?${supplier.productCount ? ` Tiene ${supplier.productCount} productos asignados.` : ''}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          deleteSupplier(supplier.id)
            .then(onChanged)
            .catch((err) => Alert.alert('No se eliminó', err instanceof Error ? err.message : 'Intentá de nuevo.'))
            .finally(() => setBusy(false));
        },
      },
    ]);

  const info: [keyof typeof Ionicons.glyphMap, string, string | null | undefined][] = [
    ['person-outline', 'Contacto', supplier.contact_name],
    ['call-outline', 'Teléfono', supplier.phone],
    ['mail-outline', 'Email', supplier.email],
    ['card-outline', 'RUC', supplier.tax_id],
    ['location-outline', 'Dirección', [supplier.address, supplier.city].filter(Boolean).join(', ')],
    ['pricetag-outline', 'Rubro', supplier.category],
    ['time-outline', 'Condición de pago', supplier.payment_terms],
    ['globe-outline', 'Web', supplier.website],
    ['wallet-outline', 'Límite de crédito', supplier.credit_limit ? formatGs(Number(supplier.credit_limit)) : null],
    ['alert-circle-outline', 'Deuda actual', supplier.current_debt ? formatGs(Number(supplier.current_debt)) : null],
    ['star-outline', 'Calificación', supplier.rating ? `${supplier.rating} / 5` : null],
  ];

  return (
    <BottomSheet
      visible
      title={supplier.name}
      subtitle={`${active ? 'Activo' : 'Inactivo'} · ${supplier.productCount ?? 0} productos`}
      onClose={onClose}
      footer={
        <View style={styles.sheetFooter}>
          <Pressable onPress={remove} disabled={busy} style={[styles.iconAction, { borderColor: colors.border }]} accessibilityLabel="Eliminar">
            <Ionicons name="trash-outline" size={20} color={palette.danger} />
          </Pressable>
          <Pressable onPress={toggle} disabled={busy} style={[styles.secondary, { borderColor: colors.border }]}>
            {busy ? <ActivityIndicator color={palette.primary} /> : <Text style={[styles.bold, { color: colors.text }]}>{active ? 'Desactivar' : 'Activar'}</Text>}
          </Pressable>
          <Pressable
            onPress={() => {
              onClose();
              router.push(`/panel/suppliers/form?id=${supplier.id}` as never);
            }}
            style={styles.primaryBtn}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.newText}>Editar</Text>
          </Pressable>
        </View>
      }>
      {phone ? (
        <View style={styles.contactRow}>
          <Pressable onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)} style={[styles.contact, { borderColor: colors.border }]}>
            <Ionicons name="call-outline" size={17} color={palette.primary} />
            <Text style={[styles.bold, { color: palette.primary }]}>Llamar</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`https://wa.me/${waNumber(phone)}`)} style={[styles.contact, { borderColor: colors.border }]}>
            <Ionicons name="logo-whatsapp" size={17} color="#16A34A" />
            <Text style={[styles.bold, { color: '#16A34A' }]}>WhatsApp</Text>
          </Pressable>
          {supplier.email ? (
            <Pressable onPress={() => Linking.openURL(`mailto:${supplier.email}`)} style={[styles.contact, { borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={17} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {info
        .filter(([, , value]) => Boolean(value))
        .map(([icon, label, value]) => (
          <View key={label} style={styles.info}>
            <Ionicons name={icon} size={16} color={colors.muted} />
            <Text style={[styles.small, styles.infoLabel, { color: colors.muted }]}>{label}</Text>
            <Text style={[styles.small, styles.flex, styles.infoValue, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
      {supplier.notes ? <Text style={[styles.notes, { color: colors.text, backgroundColor: colors.background }]}>{supplier.notes}</Text> : null}
    </BottomSheet>
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
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, height: 42 },
  newText: { color: '#fff', fontSize: 14, fontWeight: '800' },
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
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
  debt: { color: palette.danger, fontWeight: '800' },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  sheetFooter: { flexDirection: 'row', gap: 8 },
  iconAction: { width: 50, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  secondary: { flex: 1, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: palette.primary, borderRadius: 14, minHeight: 50 },
  contactRow: { flexDirection: 'row', gap: 8 },
  contact: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  infoLabel: { width: 120 },
  infoValue: { fontWeight: '600' },
  notes: { fontSize: 13, borderRadius: 10, padding: 10 },
});
