import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import {
  defaultRestock,
  fetchCases,
  fetchSummary,
  NEXT_ACTIONS,
  REJECT_REASONS,
  REQUEST,
  RESTOCK,
  STATUS,
  updateCase,
  type AfterSalesCase,
  type CaseStatus,
  type RestockAction,
} from '@/lib/after-sales';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;
type Summary = Awaited<ReturnType<typeof fetchSummary>>;

const FILTERS: { key: CaseStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Abiertos' },
  { key: 'approved', label: 'Aprobados' },
  { key: 'completed', label: 'Completados' },
  { key: 'rejected', label: 'Rechazados' },
  { key: 'all', label: 'Todos' },
];

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const money = (value: string) => {
  const only = value.replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

/** Posventa, como /dashboard/after-sales: reclamos de garantía, cambios y devoluciones. */
export default function AfterSalesScreen() {
  const colors = usePalette();
  const { findItem, loading: panelLoading } = usePanel();
  const [status, setStatus] = useState<CaseStatus | 'all'>('open');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AfterSalesCase[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<AfterSalesCase | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    fetchCases({ status, search, page: 1 })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotalPages(result.totalPages);
        setPage(1);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar los reclamos.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    fetchSummary()
      .then((data) => active && setSummary(data))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [status, search, attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    setLoadingMore(true);
    fetchCases({ status, search, page: page + 1 })
      .then((result) => {
        setRows((list) => [...list, ...result.rows.filter((row) => !list.some((item) => item.id === row.id))]);
        setPage(page + 1);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  };

  if (!panelLoading && !findItem('after-sales')) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.muted} />
        <Text style={[styles.title, { color: colors.text }]}>Posventa no disponible</Text>
      </View>
    );
  }

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
                <Text style={[styles.title, { color: colors.text }]}>Posventa</Text>
                <Text style={[styles.muted, { color: colors.muted }]}>Garantías, cambios y devoluciones</Text>
              </View>
              <Pressable onPress={() => router.push('/panel/after-sales/new' as never)} style={styles.newBtn}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.newText}>Reclamo</Text>
              </Pressable>
            </View>
            <View style={styles.kpis}>
              <Kpi label="Abiertos" value={summary ? String(summary.open) : '…'} tone={summary?.open ? '#D97706' : undefined} colors={colors} />
              <Kpi label="Aprobados" value={summary ? String(summary.approved) : '…'} tone={palette.primary} colors={colors} />
              <Kpi label="Reintegrado" value={summary ? formatGs(summary.refunds) : '…'} colors={colors} />
              <Kpi label="En revisión" value={summary ? `${summary.quarantined} u.` : '…'} colors={colors} />
            </View>
            <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={17} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="N.º de caso, cliente, venta o ticket" placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((item) => {
                const isSelected = status === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setLoading(true);
                      setStatus(item.key);
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
              <Ionicons name="refresh-circle-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{error ?? (search ? 'Sin resultados' : 'No hay reclamos en este estado')}</Text>
              {error && (
                <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                  <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}
        renderItem={({ item }) => <CaseRow item={item} colors={colors} onPress={() => setSelected(item)} />}
      />

      {selected && (
        <CaseSheet
          item={selected}
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

const origin = (item: AfterSalesCase) =>
  item.source_type === 'repair'
    ? [item.repair?.ticket_number ? `Ticket ${item.repair.ticket_number}` : 'Reparación', [item.repair?.device_brand, item.repair?.device_model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    : [item.sale?.code ? `Venta ${item.sale.code}` : 'Venta', item.product?.name ? `${item.quantity} × ${item.product.name}` : null].filter(Boolean).join(' · ');

function CaseRow({ item, colors, onPress }: { item: AfterSalesCase; colors: Colors; onPress: () => void }) {
  const request = REQUEST[item.request_type] ?? REQUEST.product_warranty;
  const status = STATUS[item.status] ?? STATUS.open;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: `${request.color}1A` }]}>
        <Ionicons name={request.icon as keyof typeof Ionicons.glyphMap} size={20} color={request.color} />
      </View>
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{item.customer?.name ?? 'Sin cliente'}</Text>
          <Tag label={status.label} color={status.color} />
        </View>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
          {request.label} · {item.case_number ?? item.id.slice(0, 6).toUpperCase()} · {date(item.created_at)}
        </Text>
        <Text numberOfLines={1} style={[styles.small, { color: colors.text }]}>{origin(item)}</Text>
      </View>
    </Pressable>
  );
}

function CaseSheet({ item, colors, onClose, onChanged }: { item: AfterSalesCase; colors: Colors; onClose: () => void; onChanged: () => void }) {
  const request = REQUEST[item.request_type] ?? REQUEST.product_warranty;
  const status = STATUS[item.status] ?? STATUS.open;
  const [action, setAction] = useState<CaseStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [refund, setRefund] = useState(item.refund_amount ? money(String(item.refund_amount)) : '');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'store_credit' | null>(item.refund_method);
  const [restock, setRestock] = useState<RestockAction>(item.restock_action ?? defaultRestock(item.request_type));
  const [reworkOk, setReworkOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundAmount = Number(refund.replace(/\D/g, '')) || 0;
  const original = item.source_type === 'sale' ? item.sale?.total_amount : item.repair?.final_cost;
  const pendingRework = Boolean(item.generatedRepair && item.generatedRepair.status !== 'entregado');
  const problem =
    action === 'rejected' && notes.trim().length < 5
      ? 'Escribí el motivo del rechazo (al menos 5 letras).'
      : action === 'completed' && refundAmount > 0 && !refundMethod
        ? 'Elegí cómo se devuelve el dinero.'
        : action === 'completed' && original != null && refundAmount > Number(original)
          ? `El reintegro supera el total original (${formatGs(Number(original))}).`
          : action === 'completed' && restock === 'sellable' && !item.product_id
            ? 'Este caso no tiene producto: elegí otro destino.'
            : action === 'completed' && pendingRework && !reworkOk
              ? 'Confirmá que querés completar con el retrabajo sin entregar.'
              : null;

  const confirm = () => {
    if (!action || problem) return;
    setSaving(true);
    setError(null);
    updateCase(
      item.id,
      action === 'completed'
        ? { status: action, restock_action: restock, refund_amount: refundAmount, refund_method: refundAmount > 0 ? refundMethod : null, ...(notes.trim() ? { notes: notes.trim() } : {}) }
        : action === 'rejected'
          ? { status: action, notes: notes.trim() }
          : { status: action }
    )
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onChanged();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo actualizar el caso.'))
      .finally(() => setSaving(false));
  };

  const actions = NEXT_ACTIONS[item.status] ?? [];

  return (
    <BottomSheet
      visible
      tall
      title={`${request.label} ${item.case_number ?? ''}`.trim()}
      subtitle={`${status.label} · abierto ${date(item.created_at)}`}
      onClose={() => !saving && onClose()}
      footer={
        action ? (
          <View style={styles.footerRow}>
            <Pressable onPress={() => setAction(null)} disabled={saving} style={[styles.secondary, { borderColor: colors.border }]}>
              <Text style={[styles.bold, { color: colors.text }]}>Volver</Text>
            </Pressable>
            <Pressable onPress={confirm} disabled={saving || Boolean(problem)} style={[styles.primaryBtn, { backgroundColor: action === 'rejected' || action === 'cancelled' ? palette.danger : palette.primary, opacity: saving || problem ? 0.6 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.newText}>Confirmar</Text>}
            </Pressable>
          </View>
        ) : actions.length ? (
          <View style={styles.footerRow}>
            {actions.map((next) => (
              <Pressable
                key={next.status}
                onPress={() => {
                  setError(null);
                  setNotes('');
                  setAction(next.status);
                }}
                style={next.destructive ? [styles.secondary, { borderColor: colors.border }] : [styles.primaryBtn, { backgroundColor: palette.primary }]}>
                <Text style={[styles.bold, { color: next.destructive ? palette.danger : '#fff' }]}>{next.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null
      }>
      <View style={[styles.box, { backgroundColor: colors.background }]}>
        <Info label="Cliente" value={[item.customer?.name, item.customer?.phone].filter(Boolean).join(' · ') || 'Sin cliente'} colors={colors} />
        <Info label="Origen" value={origin(item)} colors={colors} />
        {item.source_type === 'sale' && item.sale?.total_amount != null && <Info label="Total de la venta" value={formatGs(Number(item.sale.total_amount))} colors={colors} />}
        {item.repair?.warranty_expires_at && <Info label="Garantía hasta" value={date(item.repair.warranty_expires_at)} colors={colors} />}
        {item.replacement?.name && <Info label="Reemplazo" value={`${item.replacement_quantity ?? 1} × ${item.replacement.name}`} colors={colors} />}
        {item.price_difference ? <Info label="Diferencia" value={formatGs(Number(item.price_difference))} colors={colors} /> : null}
        {item.generatedRepair && <Info label="Retrabajo" value={`${item.generatedRepair.ticket_number ?? ''} · ${item.generatedRepair.status ?? ''}`} colors={colors} />}
        {item.refund_amount ? <Info label="Reintegro" value={`${formatGs(Number(item.refund_amount))}${item.refund_method === 'cash' ? ' por caja' : item.refund_method === 'store_credit' ? ' como saldo a favor' : ''}`} colors={colors} /> : null}
      </View>
      <Text style={[styles.label, { color: colors.text }]}>Motivo</Text>
      <Text style={[styles.small, { color: colors.text }]}>{item.reason}</Text>
      {item.notes ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Notas</Text>
          <Text style={[styles.small, { color: colors.muted }]}>{item.notes}</Text>
        </>
      ) : null}

      {action === 'approved' && <Text style={[styles.small, { color: colors.muted }]}>{item.request_type === 'repair_warranty' ? 'Al aprobar se abre un retrabajo en el taller para el equipo.' : 'El reclamo queda aprobado; al completarlo se resuelve el reintegro o el stock.'}</Text>}
      {action === 'cancelled' && <Text style={[styles.small, { color: colors.muted }]}>El reclamo se cancela sin cambios de stock ni dinero.</Text>}

      {action === 'rejected' && (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Motivo del rechazo</Text>
          <TextInput value={notes} onChangeText={setNotes} multiline maxLength={1000} placeholder="Por qué no corresponde…" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
          <View style={styles.chipsWrap}>
            {REJECT_REASONS.map((reason) => (
              <Chip key={reason} label={reason} selected={notes === reason} onPress={() => setNotes(reason)} colors={colors} />
            ))}
          </View>
        </>
      )}

      {action === 'completed' && (
        <>
          {pendingRework && (
            <View style={[styles.warn, { borderColor: '#D9770655', backgroundColor: '#D9770612' }]}>
              <Text style={[styles.small, styles.flex, { color: colors.text }]}>El retrabajo {item.generatedRepair?.ticket_number} todavía no se entregó.</Text>
              <Switch value={reworkOk} onValueChange={setReworkOk} />
            </View>
          )}
          {item.source_type === 'sale' && (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Destino de la mercadería</Text>
              {(Object.keys(RESTOCK) as RestockAction[]).map((key) => (
                <Pressable key={key} onPress={() => setRestock(key)} style={[styles.option, { borderColor: restock === key ? palette.primary : colors.border, backgroundColor: restock === key ? 'rgba(37,99,235,0.06)' : colors.background }]}>
                  <Ionicons name={restock === key ? 'radio-button-on' : 'radio-button-off'} size={18} color={restock === key ? palette.primary : colors.muted} />
                  <View style={styles.flex}>
                    <Text style={[styles.bold, { color: colors.text }]}>{RESTOCK[key].label}</Text>
                    <Text style={[styles.tiny, { color: colors.muted }]}>{RESTOCK[key].hint}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
          <Text style={[styles.label, { color: colors.text }]}>Reintegro (opcional)</Text>
          <View style={[styles.money, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.small, { color: colors.muted }]}>Gs.</Text>
            <TextInput value={refund} onChangeText={(value) => setRefund(money(value))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[styles.moneyInput, { color: colors.text }]} />
          </View>
          {refundAmount > 0 && (
            <View style={styles.chipsWrap}>
              <Chip label="Efectivo por caja" selected={refundMethod === 'cash'} onPress={() => setRefundMethod('cash')} colors={colors} />
              <Chip label="Saldo a favor" selected={refundMethod === 'store_credit'} onPress={() => setRefundMethod('store_credit')} colors={colors} />
            </View>
          )}
          <TextInput value={notes} onChangeText={setNotes} multiline maxLength={500} placeholder="Notas de la resolución (opcional)" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
        </>
      )}

      {action && problem ? <Text style={[styles.small, { color: colors.muted }]}>{problem}</Text> : null}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function Info({ label, value, colors }: { label: string; value: string; colors: Colors }) {
  return (
    <View style={styles.info}>
      <Text style={[styles.small, styles.infoLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.small, styles.flex, styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Kpi({ label, value, tone, colors }: { label: string; value: string; tone?: string; colors: Colors }) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.tiny, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: tone ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} style={[styles.chipSmall, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.08)' : colors.background }]}>
      <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }]}>{label}</Text>
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
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, height: 42 },
  newText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 2 },
  kpiValue: { fontSize: 17, fontWeight: '900' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  chips: { gap: 8, paddingRight: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipSmall: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  loading: { paddingVertical: 40 },
  more: { paddingVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  footerRow: { flexDirection: 'row', gap: 8 },
  secondary: { flex: 1, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtn: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  box: { borderRadius: 12, padding: 12, gap: 4 },
  info: { flexDirection: 'row', gap: 8 },
  infoLabel: { width: 110 },
  infoValue: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 10 },
  money: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  moneyInput: { flex: 1, fontSize: 16, fontWeight: '800', paddingVertical: 11 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
});
