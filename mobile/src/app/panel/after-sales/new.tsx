import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import {
  createCase,
  REQUEST,
  searchRepairs,
  searchReplacement,
  searchSales,
  windowFor,
  type RepairSource,
  type ReplacementProduct,
  type RequestType,
  type SaleSource,
  type SourceType,
} from '@/lib/after-sales';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;

const REASONS: Record<RequestType, string[]> = {
  repair_warranty: ['Volvió la misma falla', 'No enciende', 'Pantalla con falla', 'No carga'],
  product_warranty: ['No funciona', 'Vino fallado', 'Dejó de funcionar', 'Le falta una pieza'],
  exchange: ['Talle o modelo equivocado', 'No era lo que buscaba', 'Prefiere otro color'],
  return: ['No lo quiere', 'Compró de más', 'Producto con falla'],
};
const date = (value: Date | string | null) => (value ? new Date(value).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const money = (value: string) => {
  const only = value.replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

/** Nuevo reclamo de posventa, como «Nuevo reclamo» de la web: se busca el comprobante y se arma el caso. */
export default function NewAfterSalesCase() {
  const colors = usePalette();
  const { findItem } = usePanel();
  const workshop = Boolean(findItem('repairs'));
  const [source, setSource] = useState<SourceType>('sale');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(SaleSource | RepairSource)[] | null>(null);
  const [sale, setSale] = useState<SaleSource | null>(null);
  const [repair, setRepair] = useState<RepairSource | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState<RequestType>('product_warranty');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refund, setRefund] = useState('');
  const [replacementQuery, setReplacementQuery] = useState('');
  const [replacements, setReplacements] = useState<ReplacementProduct[]>([]);
  const [replacement, setReplacement] = useState<ReplacementProduct | null>(null);
  const [replacementQty, setReplacementQty] = useState(1);
  const [exception, setException] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = source === 'sale' ? sale : repair;

  useEffect(() => {
    if (chosen) return;
    let active = true;
    const timer = setTimeout(() => {
      (source === 'sale' ? searchSales(query) : searchRepairs(query))
        .then((rows) => active && setResults(rows))
        .catch(() => active && setResults([]));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, source, chosen]);

  useEffect(() => {
    if (type !== 'exchange' || replacement) return;
    let active = true;
    const timer = setTimeout(() => {
      searchReplacement(replacementQuery)
        .then((rows) => active && setReplacements(rows))
        .catch(() => active && setReplacements([]));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [type, replacementQuery, replacement]);

  const item = sale?.items.find((row) => row.id === itemId) ?? null;
  const deadline =
    source === 'sale' && item && sale
      ? windowFor(type, item, sale.date)
      : source === 'repair' && repair
        ? { until: repair.warrantyExpiresAt ? new Date(repair.warrantyExpiresAt) : null, expired: repair.warrantyExpired }
        : null;
  const priceDifference = type === 'exchange' && replacement && item ? replacement.price * replacementQty - item.unitPrice * quantity : null;
  const refundAmount = Number(refund.replace(/\D/g, '')) || 0;

  const problem = !chosen
    ? 'Buscá y elegí la venta o la reparación.'
    : source === 'sale' && !item
      ? 'Elegí el producto reclamado.'
      : reason.trim().length < 3
        ? 'Escribí el motivo.'
        : type === 'exchange' && (!replacement || replacement.stock < replacementQty)
          ? 'Elegí el producto de reemplazo (con stock).'
          : deadline?.expired && !exception
            ? 'Está fuera de plazo: marcá la excepción si igual lo aceptás.'
            : null;

  const reset = (next: SourceType) => {
    setSource(next);
    setSale(null);
    setRepair(null);
    setItemId(null);
    setResults(null);
    setQuery('');
    setType(next === 'repair' ? 'repair_warranty' : 'product_warranty');
    setReason('');
    setException(false);
  };

  const submit = () => {
    if (problem || !chosen) return;
    setSaving(true);
    setError(null);
    const audit = [deadline?.expired ? `[Excepción comercial autorizada: fuera de plazo desde ${date(deadline.until)}]` : null, notes.trim() || null].filter(Boolean).join('\n');
    createCase({
      source_type: source,
      request_type: type,
      repair_id: source === 'repair' ? repair?.id : null,
      sale_id: source === 'sale' ? sale?.id : null,
      sale_item_id: item?.id ?? null,
      product_id: item?.product_id ?? null,
      quantity: source === 'sale' ? quantity : 1,
      reason: reason.trim(),
      notes: audit || null,
      refund_amount: type === 'return' && refundAmount > 0 ? refundAmount : null,
      replacement_product_id: type === 'exchange' ? (replacement?.id ?? null) : null,
      replacement_quantity: type === 'exchange' ? replacementQty : null,
      price_difference: type === 'exchange' ? priceDifference : null,
    })
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (router.canGoBack()) router.back();
        else router.replace('/panel/after-sales' as never);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo registrar el reclamo.'))
      .finally(() => setSaving(false));
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/panel/after-sales' as never))} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>Nuevo reclamo</Text>
        <View style={styles.iconBtn} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {workshop && (
            <View style={[styles.segment, { borderColor: colors.border, backgroundColor: colors.card }]}>
              {(['sale', 'repair'] as const).map((key) => (
                <Pressable key={key} onPress={() => reset(key)} style={[styles.segmentItem, source === key && { backgroundColor: palette.primary }]}>
                  <Ionicons name={key === 'sale' ? 'receipt-outline' : 'construct-outline'} size={16} color={source === key ? '#fff' : colors.muted} />
                  <Text style={[styles.bold, { color: source === key ? '#fff' : colors.text }]}>{key === 'sale' ? 'Una venta' : 'Una reparación'}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Section title={source === 'sale' ? '1. La venta' : '1. La reparación'} colors={colors}>
            {chosen ? (
              <View style={[styles.picked, { borderColor: palette.primary }]}>
                <View style={styles.flex}>
                  <Text style={[styles.bold, { color: colors.text }]}>{chosen.label}</Text>
                  <Text style={[styles.small, { color: colors.muted }]}>
                    {chosen.subtitle} · {date(chosen.date)}
                    {'amount' in chosen ? ` · ${formatGs(chosen.amount)}` : ''}
                    {'device' in chosen && chosen.device ? ` · ${chosen.device}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => reset(source)} hitSlop={8}>
                  <Text style={[styles.small, { color: palette.primary, fontWeight: '800' }]}>Cambiar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Ionicons name="search" size={17} color={colors.muted} />
                  <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={source === 'sale' ? 'Código de venta, cliente o teléfono' : 'Ticket, cliente o teléfono'} placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
                </View>
                {results === null ? <ActivityIndicator color={palette.primary} /> : null}
                {results?.length === 0 && <Text style={[styles.small, { color: colors.muted }]}>{source === 'repair' ? 'No hay reparaciones entregadas con garantía que coincidan.' : 'No hay ventas que coincidan.'}</Text>}
                {results?.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      if (source === 'sale') {
                        const picked = row as SaleSource;
                        setSale(picked);
                        if (picked.items.length === 1) setItemId(picked.items[0].id);
                      } else setRepair(row as RepairSource);
                    }}
                    style={[styles.result, { borderColor: colors.border }]}>
                    <View style={styles.flex}>
                      <Text style={[styles.bold, { color: colors.text }]}>{row.label}</Text>
                      <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
                        {row.subtitle} · {date(row.date)}
                        {'device' in row && row.device ? ` · ${row.device}` : ''}
                      </Text>
                    </View>
                    {'amount' in row ? <Text style={[styles.small, { color: colors.text, fontWeight: '700' }]}>{formatGs(row.amount)}</Text> : (row as RepairSource).warrantyExpired ? <Text style={[styles.tiny, { color: palette.danger, fontWeight: '800' }]}>Vencida</Text> : null}
                  </Pressable>
                ))}
              </>
            )}
          </Section>

          {chosen && source === 'sale' && sale && (
            <Section title="2. Qué se reclama" colors={colors}>
              {sale.items.map((row) => {
                const selected = itemId === row.id;
                return (
                  <Pressable
                    key={row.id}
                    onPress={() => {
                      setItemId(row.id);
                      setQuantity(1);
                      setRefund(money(String(row.unitPrice)));
                    }}
                    style={[styles.option, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.06)' : colors.background }]}>
                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? palette.primary : colors.muted} />
                    <View style={styles.flex}>
                      <Text style={[styles.bold, { color: colors.text }]}>{row.name}</Text>
                      <Text style={[styles.tiny, { color: colors.muted }]}>
                        {row.quantity} × {formatGs(row.unitPrice)} · garantía {row.warrantyMonths} meses
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {item && item.quantity > 1 && (
                <View style={styles.qtyRow}>
                  <Text style={[styles.label, styles.flex, { color: colors.text }]}>Unidades reclamadas</Text>
                  <Stepper value={quantity} max={item.quantity} onChange={setQuantity} colors={colors} />
                </View>
              )}
              <Text style={[styles.label, { color: colors.text }]}>Tipo de reclamo</Text>
              {(['product_warranty', 'exchange', 'return'] as const).map((key) => (
                <Pressable key={key} onPress={() => setType(key)} style={[styles.option, { borderColor: type === key ? REQUEST[key].color : colors.border, backgroundColor: type === key ? `${REQUEST[key].color}10` : colors.background }]}>
                  <Ionicons name={REQUEST[key].icon as keyof typeof Ionicons.glyphMap} size={18} color={REQUEST[key].color} />
                  <View style={styles.flex}>
                    <Text style={[styles.bold, { color: colors.text }]}>{REQUEST[key].label}</Text>
                    <Text style={[styles.tiny, { color: colors.muted }]}>{REQUEST[key].hint}</Text>
                  </View>
                </Pressable>
              ))}
            </Section>
          )}

          {chosen && deadline && (
            <View style={[styles.deadline, { borderColor: deadline.expired ? '#DC262655' : '#16A34A55', backgroundColor: deadline.expired ? '#DC262610' : '#16A34A10' }]}>
              <Ionicons name={deadline.expired ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={20} color={deadline.expired ? palette.danger : palette.success} />
              <View style={styles.flex}>
                <Text style={[styles.bold, { color: colors.text }]}>{deadline.expired ? 'Fuera de plazo' : 'Dentro del plazo'}</Text>
                <Text style={[styles.tiny, { color: colors.muted }]}>{deadline.until ? `${deadline.expired ? 'Venció' : 'Vence'} el ${date(deadline.until)}` : 'Sin fecha de vencimiento'}</Text>
              </View>
              {deadline.expired && <Switch value={exception} onValueChange={setException} accessibilityLabel="Aceptar como excepción" />}
            </View>
          )}

          {chosen && type === 'exchange' && (
            <Section title="Producto de reemplazo" colors={colors}>
              {replacement ? (
                <>
                  <View style={[styles.picked, { borderColor: palette.primary }]}>
                    <View style={styles.flex}>
                      <Text style={[styles.bold, { color: colors.text }]}>{replacement.name}</Text>
                      <Text style={[styles.small, { color: replacement.stock < replacementQty ? palette.danger : colors.muted }]}>
                        {formatGs(replacement.price)} · stock {replacement.stock}
                      </Text>
                    </View>
                    <Pressable onPress={() => setReplacement(null)} hitSlop={8}>
                      <Text style={[styles.small, { color: palette.primary, fontWeight: '800' }]}>Cambiar</Text>
                    </Pressable>
                  </View>
                  <View style={styles.qtyRow}>
                    <Text style={[styles.label, styles.flex, { color: colors.text }]}>Cantidad</Text>
                    <Stepper value={replacementQty} max={Math.max(1, replacement.stock)} onChange={setReplacementQty} colors={colors} />
                  </View>
                  {priceDifference !== null && (
                    <Text style={[styles.bold, { color: priceDifference > 0 ? palette.danger : priceDifference < 0 ? palette.success : colors.text }]}>
                      {priceDifference > 0 ? `El cliente paga la diferencia: ${formatGs(priceDifference)}` : priceDifference < 0 ? `A favor del cliente: ${formatGs(-priceDifference)}` : 'Sin diferencia de precio'}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Ionicons name="search" size={17} color={colors.muted} />
                    <TextInput value={replacementQuery} onChangeText={setReplacementQuery} placeholder="Buscar producto" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.text }]} />
                  </View>
                  {replacements.map((row) => (
                    <Pressable key={row.id} disabled={row.stock <= 0} onPress={() => setReplacement(row)} style={[styles.result, { borderColor: colors.border, opacity: row.stock <= 0 ? 0.45 : 1 }]}>
                      <Text numberOfLines={1} style={[styles.bold, styles.flex, { color: colors.text }]}>{row.name}</Text>
                      <Text style={[styles.small, { color: colors.muted }]}>
                        {formatGs(row.price)} · {row.stock > 0 ? `stock ${row.stock}` : 'sin stock'}
                      </Text>
                    </Pressable>
                  ))}
                </>
              )}
            </Section>
          )}

          {chosen && (
            <Section title={source === 'sale' ? '3. Motivo' : '2. Motivo'} colors={colors}>
              <View style={styles.chipsWrap}>
                {REASONS[type].map((text) => (
                  <Pressable key={text} onPress={() => setReason(text)} style={[styles.chip, { borderColor: reason === text ? palette.primary : colors.border, backgroundColor: reason === text ? 'rgba(37,99,235,0.08)' : colors.background }]}>
                    <Text style={[styles.chipText, { color: reason === text ? palette.primary : colors.text }]}>{text}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={reason} onChangeText={setReason} maxLength={1000} multiline placeholder="Qué le pasa, según el cliente" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
              {type === 'return' && (
                <>
                  <Text style={[styles.label, { color: colors.text }]}>Reintegro propuesto</Text>
                  <View style={[styles.money, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Text style={[styles.small, { color: colors.muted }]}>Gs.</Text>
                    <TextInput value={refund} onChangeText={(value) => setRefund(money(value))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[styles.moneyInput, { color: colors.text }]} />
                  </View>
                  <Text style={[styles.tiny, { color: colors.muted }]}>Se paga al completar el caso, por caja o como saldo a favor.</Text>
                </>
              )}
              <TextInput value={notes} onChangeText={setNotes} maxLength={2000} placeholder="Notas internas (opcional)" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
            </Section>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {problem ? <Text style={[styles.tiny, styles.centerText, { color: colors.muted }]}>{problem}</Text> : null}
          <Pressable onPress={submit} disabled={saving || Boolean(problem)} style={[styles.submit, { opacity: saving || problem ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            <Text style={styles.submitText}>Registrar reclamo</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Stepper({ value, max, onChange, colors }: { value: number; max: number; onChange: (value: number) => void; colors: Colors }) {
  return (
    <View style={[styles.stepper, { borderColor: colors.border }]}>
      <Pressable onPress={() => onChange(Math.max(1, value - 1))} hitSlop={8}>
        <Ionicons name="remove" size={18} color={colors.text} />
      </Pressable>
      <Text style={[styles.bold, styles.qty, { color: colors.text }]}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} hitSlop={8}>
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

function Section({ title, colors, children }: { title: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerText: { textAlign: 'center' },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, paddingVertical: 10 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 38 },
  qty: { minWidth: 22, textAlign: 'center' },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  money: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  moneyInput: { flex: 1, fontSize: 16, fontWeight: '800', paddingVertical: 11 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  footer: { padding: 12, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 54 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
