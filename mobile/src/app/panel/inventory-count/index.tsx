import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { COUNT_STATUS, createCount, fetchBranches, fetchCounts, type InventoryCount } from '@/lib/inventory-count';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;
type Data = Awaited<ReturnType<typeof fetchCounts>>;

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Tomas de inventario, como /dashboard/inventory-count: abiertas con su avance y las anteriores. */
export default function InventoryCountsScreen() {
  const colors = usePalette();
  const { findItem, loading: panelLoading } = usePanel();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCounts()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar las tomas.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  if (!panelLoading && !findItem('inventory-count')) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.muted} />
        <Text style={[styles.title, { color: colors.text }]}>Toma de inventario no disponible</Text>
      </View>
    );
  }

  const open = data?.counts.find((count) => count.status === 'counting');

  return (
    <View style={styles.flex}>
      <FlatList
        data={data?.counts ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]}>Toma de inventario</Text>
                <Text style={[styles.muted, { color: colors.muted }]}>Contá el stock real y ajustalo en un paso.</Text>
              </View>
              {data?.canAdjust && (
                <Pressable onPress={() => setCreating(true)} style={styles.newBtn}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.newText}>Nueva</Text>
                </Pressable>
              )}
            </View>
            {open && (
              <Pressable onPress={() => router.push(`/panel/inventory-count/${open.id}` as never)} style={styles.resume}>
                <Ionicons name="barcode-outline" size={24} color="#fff" />
                <View style={styles.flex}>
                  <Text style={styles.resumeTitle}>Seguir contando #{open.number}</Text>
                  <Text style={styles.resumeSub}>
                    {open.name}
                    {data?.progress[open.id] ? ` · ${data.progress[open.id].counted} de ${data.progress[open.id].total} contados` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          !data ? (
            error ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{error}</Text>
                <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                  <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
                </Pressable>
              </View>
            ) : (
              <ActivityIndicator style={styles.loading} color={palette.primary} />
            )
          ) : !data.available ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>La toma de inventario todavía no está habilitada en el sistema.</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Todavía no hiciste ninguna toma</Text>
              <Text style={[styles.small, styles.centerText, { color: colors.muted }]}>Al abrir una se guarda el stock del sistema; después contás con el celular y ajustás las diferencias.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <CountRow count={item} progress={data?.progress[item.id]} colors={colors} />}
      />

      {creating && data && (
        <NewCountSheet
          categories={data.categories}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            reload();
            router.push(`/panel/inventory-count/${id}` as never);
          }}
        />
      )}
    </View>
  );
}

function CountRow({ count, progress, colors }: { count: InventoryCount; progress?: { total: number; counted: number }; colors: Colors }) {
  const status = COUNT_STATUS[count.status] ?? COUNT_STATUS.counting;
  const summary = count.summary ?? {};
  const rawValue = summary.valueDifference ?? summary.value_difference;
  const value = rawValue == null ? null : Number(rawValue);
  return (
    <Pressable onPress={() => router.push(`/panel/inventory-count/${count.id}` as never)} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.number, { backgroundColor: `${status.color}1A` }]}>
        <Text style={[styles.numberText, { color: status.color }]}>#{count.number}</Text>
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{count.name}</Text>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
          {[count.branchName, count.categoryName ?? 'Todo el catálogo', date(count.applied_at ?? count.created_at)].filter(Boolean).join(' · ')}
        </Text>
        {count.status === 'counting' && progress ? (
          <View style={[styles.bar, { backgroundColor: colors.background }]}>
            <View style={[styles.barFill, { width: `${progress.total ? Math.round((progress.counted / progress.total) * 100) : 0}%` }]} />
          </View>
        ) : count.status === 'applied' && value ? (
          <Text style={[styles.small, { color: value < 0 ? palette.danger : palette.success, fontWeight: '800' }]}>
            {value < 0 ? 'Faltante' : 'Sobrante'} {formatGs(Math.abs(value))}
          </Text>
        ) : null}
      </View>
      <View style={[styles.tag, { backgroundColor: `${status.color}1A` }]}>
        <Text style={[styles.tagText, { color: status.color }]}>{status.label}</Text>
      </View>
    </Pressable>
  );
}

function NewCountSheet({ categories, onClose, onCreated }: { categories: { id: string; name: string }[]; onClose: () => void; onCreated: (id: string) => void }) {
  const colors = usePalette();
  const [branches, setBranches] = useState<{ id: string; name: string }[] | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState(`Toma ${new Date().toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}`);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBranches()
      .then((rows) => {
        setBranches(rows);
        if (rows.length > 0) setBranchId(rows[0].id);
      })
      .catch(() => setBranches([]));
  }, []);

  const create = () => {
    if (!branchId) return setError('Elegí la sucursal.');
    if (!name.trim()) return setError('Poné un nombre a la toma.');
    setSaving(true);
    setError(null);
    createCount({ branchId, name, categoryId, notes })
      .then((result) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCreated(result.count.id);
      })
      .catch((err: Error & { openCountId?: string }) => {
        if (err.openCountId) {
          const openId = err.openCountId;
          Alert.alert('Ya hay una toma abierta', err.message, [
            { text: 'Cerrar', style: 'cancel' },
            { text: 'Abrirla', onPress: () => onCreated(openId) },
          ]);
        } else setError(err.message);
      })
      .finally(() => setSaving(false));
  };

  return (
    <BottomSheet
      visible
      title="Nueva toma de inventario"
      subtitle="Se guarda el stock actual de la sucursal para comparar con lo que cuentes."
      onClose={() => !saving && onClose()}
      footer={
        <Pressable onPress={create} disabled={saving} style={[styles.primary, { opacity: saving ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="play-circle-outline" size={20} color="#fff" />}
          <Text style={styles.primaryText}>Abrir toma</Text>
        </Pressable>
      }>
      <Text style={[styles.label, { color: colors.text }]}>Nombre</Text>
      <TextInput value={name} onChangeText={setName} maxLength={120} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
      <Text style={[styles.label, { color: colors.text }]}>Sucursal</Text>
      {branches === null ? (
        <ActivityIndicator color={palette.primary} />
      ) : (
        <View style={styles.chipsWrap}>
          {branches.map((branch) => (
            <Chip key={branch.id} label={branch.name} selected={branchId === branch.id} onPress={() => setBranchId(branch.id)} colors={colors} />
          ))}
        </View>
      )}
      <Text style={[styles.label, { color: colors.text }]}>Qué contar</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Todo el catálogo" selected={categoryId === null} onPress={() => setCategoryId(null)} colors={colors} />
        {categories.map((category) => (
          <Chip key={category.id} label={category.name} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} colors={colors} />
        ))}
      </ScrollView>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Notas (opcional)" placeholderTextColor={colors.muted} maxLength={2000} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function Chip({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.background }]}>
      <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  centerText: { textAlign: 'center' },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13 },
  small: { fontSize: 12 },
  bold: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, height: 42 },
  newText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.primary, borderRadius: 16, padding: 14 },
  resumeTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  resumeSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  loading: { paddingVertical: 40 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  number: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '900' },
  name: { fontSize: 15, fontWeight: '800' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', backgroundColor: palette.primary },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  chips: { gap: 8, paddingRight: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 52 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
