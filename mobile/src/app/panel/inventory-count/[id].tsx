import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import {
  COUNT_STATUS,
  countDifference,
  fetchCount,
  findByCode,
  finishCount,
  parseScan,
  saveCounts,
  summarizeCount,
  type CountItem,
  type InventoryCount,
} from '@/lib/inventory-count';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

type Colors = ReturnType<typeof usePalette>;
type Filter = 'pending' | 'counted' | 'diff' | 'all';
type Update = { item_id: string; counted_qty: number | null; match_system?: boolean };

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Sin contar' },
  { key: 'counted', label: 'Contados' },
  { key: 'diff', label: 'Con diferencia' },
  { key: 'all', label: 'Todos' },
];

/**
 * Conteo de una toma: escanear o buscar el producto, anotar cuántos hay (se
 * guarda solo) y, al terminar, aplicar las diferencias al stock.
 */
export default function InventoryCountScreen() {
  const colors = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [count, setCount] = useState<InventoryCount | null>(null);
  const [items, setItems] = useState<CountItem[]>([]);
  const [canAdjust, setCanAdjust] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>('pending');
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const pending = useRef(new Map<string, Update>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    fetchCount(id)
      .then((result) => {
        if (!active) return;
        setCount(result.count);
        setItems(result.items);
        setCanAdjust(result.canAdjust);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo abrir la toma.'));
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const updates = [...pending.current.values()];
    if (updates.length === 0) return true;
    pending.current.clear();
    setSaving((n) => n + 1);
    try {
      const saved = await saveCounts(id, updates);
      const byId = new Map(saved.map((item) => [item.id, item]));
      // Lo que vuelve trae el stock del sistema al momento de contar; si mientras
      // tanto se tocó otra vez ese producto, gana lo último que se anotó.
      setItems((list) => list.map((item) => (byId.has(item.id) && !pending.current.has(item.id) ? byId.get(item.id)! : item)));
      setSaveError(null);
      return true;
    } catch (err) {
      for (const update of updates) if (!pending.current.has(update.item_id)) pending.current.set(update.item_id, update);
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el conteo.');
      return false;
    } finally {
      setSaving((n) => n - 1);
    }
  }, [id]);

  useEffect(
    () => () => {
      void flush();
    },
    [flush]
  );

  const queue = (item: CountItem, quantity: number | null, matchSystem = false) => {
    const counted = matchSystem ? item.system_qty : quantity === null ? null : Math.max(0, Math.round(quantity));
    setItems((list) => list.map((row) => (row.id === item.id ? { ...row, counted_qty: counted, system_qty_at_count: counted === null ? null : (row.system_qty_at_count ?? row.system_qty) } : row)));
    pending.current.set(item.id, { item_id: item.id, counted_qty: matchSystem ? null : counted, ...(matchSystem ? { match_system: true } : {}) });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  };

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1800);
  };

  const scan = (raw: string) => {
    const { code: value, quantity } = parseScan(raw);
    const item = findByCode(items, value);
    if (!item) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      flash(`El código ${value} no está en esta toma.`);
      return;
    }
    const next = (item.counted_qty ?? 0) + quantity;
    void Haptics.selectionAsync();
    queue(item, next);
    flash(`${item.name}: ${next}`);
    setQuery('');
  };

  const finish = (action: 'apply' | 'cancel') => {
    const summary = summarizeCount(items);
    const text =
      action === 'apply'
        ? `Se ajusta el stock de ${summary.withDifference} productos con diferencia (+${summary.unitsIn} / −${summary.unitsOut} unidades, ${formatGs(summary.valueDifference)}).${summary.notCounted ? ` ${summary.notCounted} quedaron sin contar.` : ''}`
        : 'La toma se anula y no se cambia ningún stock.';
    Alert.alert(action === 'apply' ? 'Aplicar la toma' : 'Anular la toma', text, [
      { text: 'Volver', style: 'cancel' },
      {
        text: action === 'apply' ? 'Aplicar' : 'Anular',
        style: action === 'apply' ? 'default' : 'destructive',
        onPress: async () => {
          setFinishing(true);
          try {
            if (!(await flush())) throw new Error('Hay conteos sin guardar. Revisá la conexión y probá de nuevo.');
            await finishCount(id, action);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setAttempt((n) => n + 1);
          } catch (err) {
            Alert.alert('No se pudo', err instanceof Error ? err.message : 'Intentá de nuevo.');
          } finally {
            setFinishing(false);
          }
        },
      },
    ]);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/panel/inventory-count' as never));

  if (!count) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
            <Pressable onPress={() => setAttempt((n) => n + 1)} style={[styles.outline, { borderColor: colors.border }]}>
              <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={palette.primary} />
        )}
      </View>
    );
  }

  const editable = count.status === 'counting' && canAdjust;
  const summary = summarizeCount(items);
  const status = COUNT_STATUS[count.status] ?? COUNT_STATUS.counting;
  const term = query.trim().toLowerCase();
  const shown = items.filter((item) => {
    const diff = countDifference(item);
    if (filter === 'pending' && item.counted_qty !== null) return false;
    if (filter === 'counted' && item.counted_qty === null) return false;
    if (filter === 'diff' && !diff) return false;
    if (!term) return true;
    return [item.name, item.sku, item.barcode, item.category_name].some((value) => value?.toLowerCase().includes(term));
  });

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={back} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: colors.text }]}>
            #{count.number} {count.name}
          </Text>
          <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
            {[count.branchName, count.categoryName ?? 'Todo el catálogo'].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {saving > 0 ? <ActivityIndicator color={palette.primary} /> : <View style={[styles.tag, { backgroundColor: `${status.color}1A` }]}><Text style={[styles.tagText, { color: status.color }]}>{status.label}</Text></View>}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.progressTop}>
                <Text style={[styles.progressValue, { color: colors.text }]}>{summary.progress}%</Text>
                <Text style={[styles.small, { color: colors.muted }]}>
                  {summary.counted} de {summary.total} contados
                </Text>
              </View>
              <View style={[styles.bar, { backgroundColor: colors.background }]}>
                <View style={[styles.barFill, { width: `${summary.progress}%` }]} />
              </View>
              <View style={styles.stats}>
                <Stat label="Diferencias" value={String(summary.withDifference)} colors={colors} />
                <Stat label="Sobran" value={`+${summary.unitsIn}`} tone={palette.success} colors={colors} />
                <Stat label="Faltan" value={`−${summary.unitsOut}`} tone={palette.danger} colors={colors} />
                <Stat label="Valor" value={formatGs(summary.valueDifference)} tone={summary.valueDifference < 0 ? palette.danger : undefined} colors={colors} />
              </View>
            </View>

            {saveError && (
              <Pressable onPress={() => void flush()} style={[styles.warn, { borderColor: '#DC262655', backgroundColor: '#DC262610' }]}>
                <Ionicons name="cloud-offline-outline" size={18} color={palette.danger} />
                <Text style={[styles.small, styles.flex, { color: colors.text }]}>{saveError} Tocá para reintentar.</Text>
              </Pressable>
            )}

            {editable && (
              <View style={styles.scanRow}>
                <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="barcode-outline" size={18} color={colors.muted} />
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    onSubmitEditing={() => {
                      if (code.trim()) scan(code);
                      setCode('');
                    }}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    autoCorrect={false}
                    autoCapitalize="none"
                    placeholder="Código (3*código suma 3)"
                    placeholderTextColor={colors.muted}
                    style={[styles.searchInput, { color: colors.text }]}
                  />
                </View>
                <Pressable onPress={() => setScanning(true)} style={styles.scanBtn} accessibilityLabel="Escanear con la cámara">
                  <Ionicons name="scan-outline" size={22} color="#fff" />
                </Pressable>
              </View>
            )}

            <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={17} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Buscar producto, SKU o categoría" placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((item) => {
                const selected = filter === item.key;
                const amount = item.key === 'pending' ? summary.notCounted : item.key === 'counted' ? summary.counted : item.key === 'diff' ? summary.withDifference : summary.total;
                return (
                  <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? palette.primary : colors.card }]}>
                    <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>
                      {item.label} · {amount}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={<Text style={[styles.small, styles.emptyText, { color: colors.muted }]}>{filter === 'pending' && !term ? '¡Ya contaste todo! Revisá las diferencias y aplicá la toma.' : 'No hay productos con ese filtro.'}</Text>}
        renderItem={({ item }) => <ItemRow item={item} editable={editable} colors={colors} onChange={(value) => queue(item, value)} onMatch={() => queue(item, null, true)} />}
      />

      {toast && (
        <View style={[styles.toast, { backgroundColor: colors.text }]}>
          <Text style={[styles.toastText, { color: colors.background }]}>{toast}</Text>
        </View>
      )}

      {editable && (
        <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable onPress={() => finish('cancel')} disabled={finishing} style={[styles.cancel, { borderColor: colors.border }]}>
            <Text style={[styles.bold, { color: palette.danger }]}>Anular</Text>
          </Pressable>
          <Pressable onPress={() => finish('apply')} disabled={finishing || summary.counted === 0} style={[styles.apply, { opacity: finishing || summary.counted === 0 ? 0.6 : 1 }]}>
            {finishing ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-done" size={20} color="#fff" />}
            <Text style={styles.applyText}>Aplicar al stock</Text>
          </Pressable>
        </View>
      )}

      <BarcodeScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={(value) => {
          setScanning(false);
          scan(value);
        }}
        title="Escaneá el producto"
      />
    </View>
  );
}

function ItemRow({ item, editable, colors, onChange, onMatch }: { item: CountItem; editable: boolean; colors: Colors; onChange: (value: number | null) => void; onMatch: () => void }) {
  const diff = countDifference(item);
  const system = item.system_qty_at_count ?? item.system_qty;
  const tone = diff === null ? colors.border : diff === 0 ? palette.success : diff > 0 ? '#2563EB' : palette.danger;
  return (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: diff === null ? colors.border : `${tone}66` }]}>
      <View style={styles.itemTop}>
        <View style={styles.flex}>
          <Text numberOfLines={2} style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
          <Text numberOfLines={1} style={[styles.tiny, { color: colors.muted }]}>
            {[item.sku, item.barcode, item.category_name].filter(Boolean).join(' · ') || 'Sin código'}
          </Text>
        </View>
        <View style={styles.systemBox}>
          <Text style={[styles.tiny, { color: colors.muted }]}>Sistema</Text>
          <Text style={[styles.bold, { color: colors.text }]}>{system}</Text>
        </View>
      </View>
      <View style={styles.itemBottom}>
        {editable ? (
          <>
            <View style={[styles.stepper, { borderColor: colors.border }]}>
              <Pressable onPress={() => onChange(Math.max(0, (item.counted_qty ?? 0) - 1))} hitSlop={8} accessibilityLabel="Restar uno">
                <Ionicons name="remove" size={20} color={colors.text} />
              </Pressable>
              <TextInput
                value={item.counted_qty === null ? '' : String(item.counted_qty)}
                onChangeText={(text) => onChange(text.replace(/\D/g, '') === '' ? null : Number(text.replace(/\D/g, '')))}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
                accessibilityLabel={`Contado de ${item.name}`}
                style={[styles.qty, { color: colors.text }]}
              />
              <Pressable onPress={() => onChange((item.counted_qty ?? 0) + 1)} hitSlop={8} accessibilityLabel="Sumar uno">
                <Ionicons name="add" size={20} color={colors.text} />
              </Pressable>
            </View>
            {item.counted_qty === null && (
              <Pressable onPress={onMatch} style={[styles.match, { borderColor: colors.border }]}>
                <Ionicons name="checkmark" size={15} color={palette.success} />
                <Text style={[styles.small, { color: colors.text, fontWeight: '700' }]}>Coincide</Text>
              </Pressable>
            )}
          </>
        ) : (
          <Text style={[styles.bold, { color: colors.text }]}>Contado: {item.counted_qty ?? '—'}</Text>
        )}
        <View style={styles.flex} />
        {diff !== null && (
          <View style={[styles.diff, { backgroundColor: `${tone}1A` }]}>
            <Text style={[styles.diffText, { color: tone }]}>{diff === 0 ? 'OK' : diff > 0 ? `+${diff}` : `${diff}`}</Text>
          </View>
        )}
        {item.applied_delta !== null && item.applied_delta !== 0 && <Text style={[styles.tiny, { color: colors.muted }]}>ajustado {item.applied_delta > 0 ? '+' : ''}{item.applied_delta}</Text>}
      </View>
    </View>
  );
}

function Stat({ label, value, tone, colors }: { label: string; value: string; tone?: string; colors: Colors }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.tiny, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: tone ?? colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '800' },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  content: { padding: 12, gap: 8, paddingBottom: 110 },
  header: { gap: 10, marginBottom: 2 },
  progressCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  progressValue: { fontSize: 26, fontWeight: '900' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: palette.primary, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 1 },
  statValue: { fontSize: 14, fontWeight: '900' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  scanRow: { flexDirection: 'row', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  scanBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  emptyText: { textAlign: 'center', paddingVertical: 30 },
  item: { borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 10 },
  itemTop: { flexDirection: 'row', gap: 10 },
  itemName: { fontSize: 14, fontWeight: '700' },
  systemBox: { alignItems: 'flex-end' },
  itemBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 42 },
  qty: { width: 56, textAlign: 'center', fontSize: 17, fontWeight: '900', paddingVertical: 4 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 42 },
  diff: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  diffText: { fontSize: 14, fontWeight: '900' },
  toast: { position: 'absolute', bottom: 96, alignSelf: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '90%' },
  toastText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  cancel: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  apply: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.success, borderRadius: 14, minHeight: 52 },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
