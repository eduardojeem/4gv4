import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { lineFromInventory, newIdempotencyKey, searchInventory, type CostLine, type InventoryItem } from '@/lib/repairs';

type Colors = ReturnType<typeof usePalette>;

/**
 * Repuestos y servicios de una reparación, igual que RepairPartsEditor de la
 * web: buscar en el inventario, «Agregar servicio», «Agregar repuesto» (carga
 * manual) y una tarjeta por línea con cantidad, costo interno, precio al
 * cliente, descuento, IVA y subtotal.
 */

/** Línea en edición: los importes como texto para escribir con puntos de miles. */
export type BudgetLine = CostLine & {
  key: string;
  qtyText: string;
  priceText: string;
  costText: string;
  discountText: string;
  stock?: number | null;
};

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
export const prettyAmount = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

export const toBudgetLine = (line: CostLine & { stock?: number | null }): BudgetLine => ({
  discountAmount: 0,
  taxRate: 10,
  ...line,
  key: newIdempotencyKey(),
  qtyText: String(line.quantity || 1),
  priceText: prettyAmount(line.unitPrice || 0),
  costText: prettyAmount(line.unitCost || 0),
  discountText: prettyAmount(line.discountAmount || 0),
});

export const fromBudgetLine = (line: BudgetLine): CostLine => ({
  name: line.name,
  quantity: digits(line.qtyText),
  unitPrice: line.lineType === 'included_material' ? 0 : digits(line.priceText),
  // El costo de un repuesto del inventario lo pone el servidor; el manual lo escribe la persona.
  unitCost: line.productId ? line.unitCost ?? null : digits(line.costText),
  productId: line.productId ?? null,
  partNumber: line.partNumber ?? null,
  supplier: line.supplier ?? null,
  discountAmount: line.lineType === 'included_material' ? 0 : digits(line.discountText),
  taxRate: line.taxRate ?? 10,
  lineType: line.lineType,
  sourceProductId: line.sourceProductId ?? null,
});

const lineSubtotal = (line: BudgetLine) =>
  line.lineType === 'included_material' ? 0 : Math.max(0, digits(line.qtyText) * digits(line.priceText) - digits(line.discountText));

/** Lo que paga el cliente por las líneas (precio × cantidad − descuento). */
export const linesTotal = (lines: BudgetLine[]) => lines.reduce((sum, line) => sum + lineSubtotal(line), 0);

/** Un repuesto del inventario no se puede cobrar por debajo de lo que costó. */
const belowCost = (line: BudgetLine) =>
  line.lineType === 'charged_part' && Boolean(line.productId) && Number(line.unitCost) > 0 && digits(line.priceText) < Number(line.unitCost);

export const budgetProblem = (lines: BudgetLine[]) => {
  if (lines.some((line) => !line.name.trim() || digits(line.qtyText) < 1)) return 'Cada línea necesita nombre y cantidad.';
  if (lines.some(belowCost)) return 'Hay un repuesto con precio debajo del costo de inventario.';
  return null;
};

const LINE_LABEL: Record<CostLine['lineType'], string> = {
  service: 'Servicio',
  included_material: 'Material incluido',
  charged_part: 'Repuesto cobrado',
};

export function BudgetLines({
  lines,
  onChange,
  repairId,
  customerIsWholesale = false,
  canViewCost = false,
  allowLineDiscount = true,
}: {
  lines: BudgetLine[];
  onChange: (lines: BudgetLine[]) => void;
  repairId?: string;
  customerIsWholesale?: boolean;
  /** Costo interno: solo administradores, como en la web. */
  canViewCost?: boolean;
  /** Al crear la orden la API no recibe descuento por línea. */
  allowLineDiscount?: boolean;
}) {
  const colors = usePalette();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceName, setServiceName] = useState('Servicio técnico');
  const [serviceAmount, setServiceAmount] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchInventory(q, repairId)
        .then((items) => active && setResults(items))
        .catch(() => active && setResults([]))
        .finally(() => active && setSearching(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, repairId]);

  const update = (index: number, patch: Partial<BudgetLine>) => onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const addSuggestion = (item: InventoryItem) => {
    void Haptics.selectionAsync();
    const existing = lines.findIndex((line) => line.productId === item.productId);
    if (existing >= 0) {
      update(existing, { qtyText: String(digits(lines[existing].qtyText) + 1) });
    } else {
      const selected = toBudgetLine({ ...lineFromInventory(item), stock: item.availableStock });
      // Un servicio que trae material suma su «Material incluido» (costo, sin precio), como la web.
      const included =
        item.lineType === 'service' && (item.includesMaterial || Number(item.includedMaterialCost) > 0)
          ? [
              toBudgetLine({
                name: `Material incluido · ${item.name}`,
                quantity: 1,
                unitPrice: 0,
                unitCost: Number(item.includedMaterialCost ?? 0),
                productId: null,
                sourceProductId: item.productId,
                partNumber: item.sku || null,
                supplier: 'Incluido en el servicio',
                taxRate: item.taxRate ?? 10,
                lineType: 'included_material',
              }),
            ]
          : [];
      onChange([...lines, selected, ...included]);
    }
    setQuery('');
    setResults([]);
  };

  const addManualPart = () => {
    void Haptics.selectionAsync();
    onChange([
      ...lines,
      toBudgetLine({ name: 'Repuesto manual', supplier: 'Carga manual', quantity: 1, unitPrice: 0, unitCost: 0, productId: null, lineType: 'charged_part' }),
    ]);
  };

  const addManualService = () => {
    if (!serviceName.trim() || digits(serviceAmount) <= 0) return;
    void Haptics.selectionAsync();
    onChange([
      ...lines,
      toBudgetLine({ name: serviceName.trim(), supplier: 'Servicio manual', quantity: 1, unitPrice: digits(serviceAmount), unitCost: 0, productId: null, lineType: 'service' }),
    ]);
    setServiceOpen(false);
    setServiceName('Servicio técnico');
    setServiceAmount('');
  };

  const showResults = query.trim().length >= 2;

  return (
    <View style={styles.wrap}>
      {/* Buscador y altas rápidas */}
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.text }]}>Buscar en inventario</Text>
        <View style={styles.headerButtons}>
          <Pressable onPress={() => setServiceOpen((value) => !value)} style={[styles.smallBtn, { borderColor: colors.border }]} accessibilityRole="button">
            <Ionicons name="construct-outline" size={14} color="#0891B2" />
            <Text style={[styles.smallBtnText, { color: colors.text }]}>Agregar servicio</Text>
          </Pressable>
          <Pressable onPress={addManualPart} style={[styles.smallBtn, { borderColor: colors.border }]} accessibilityRole="button">
            <Ionicons name="add" size={15} color="#16A34A" />
            <Text style={[styles.smallBtnText, { color: colors.text }]}>Agregar repuesto</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Nombre o SKU del repuesto..."
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          accessibilityLabel="Buscar en inventario"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {searching ? <ActivityIndicator size="small" color="#0891B2" /> : null}
      </View>

      {showResults && results.length > 0 && (
        <View style={[styles.results, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="list">
          {results.map((item, index) => (
            <Pressable
              key={item.productId}
              onPress={() => addSuggestion(item)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.result,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                pressed && { backgroundColor: colors.background },
              ]}>
              <View style={styles.flex}>
                <Text style={[styles.resultName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.small, { color: item.lineType !== 'service' && (item.availableStock ?? 0) <= 0 ? palette.danger : colors.muted }]}>
                  {[item.sku, item.lineType === 'service' ? 'Servicio · no descuenta stock' : `Stock: ${item.availableStock ?? 0}`].filter(Boolean).join(' · ')}
                </Text>
                {item.wholesalePriceApplied && <Text style={[styles.small, styles.bold, { color: '#0369A1' }]}>Precio mayorista aplicado</Text>}
                {item.wholesalePriceFallback && (
                  <Text style={[styles.small, styles.bold, { color: '#B45309' }]}>Sin tarifa mayorista configurada · se usará precio minorista</Text>
                )}
              </View>
              <View style={styles.alignEnd}>
                <Text style={[styles.resultPrice, { color: colors.text }]}>{formatGs(item.unitPrice)}</Text>
                {item.wholesalePriceApplied && item.retailPrice ? (
                  <Text style={[styles.small, styles.strike, { color: colors.muted }]}>{formatGs(item.retailPrice)}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {showResults && !searching && results.length === 0 && (
        <Text style={[styles.small, { color: colors.muted }]}>Nada en el inventario con «{query.trim()}». Usá «Agregar repuesto» para cargarlo a mano.</Text>
      )}
      {customerIsWholesale && (
        <Text style={[styles.small, { color: '#0369A1' }]}>
          Cliente mayorista: se aplica su tarifa cuando existe; si falta, verás el precio minorista claramente indicado.
        </Text>
      )}

      {/* Servicio manual, como «Agregar servicio manual» de la web */}
      {serviceOpen && (
        <View style={[styles.serviceBox, { borderColor: 'rgba(37,99,235,0.3)', backgroundColor: 'rgba(37,99,235,0.05)' }]}>
          <Text style={[styles.label, { color: colors.text }]}>Agregar servicio manual</Text>
          <TextInput
            value={serviceName}
            onChangeText={setServiceName}
            accessibilityLabel="Nombre del servicio"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
          <View style={[styles.money, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.small, { color: colors.muted }]}>Gs.</Text>
            <TextInput
              value={serviceAmount}
              onChangeText={(value) => setServiceAmount(prettyAmount(value))}
              keyboardType="number-pad"
              placeholder="Precio del servicio"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Precio del servicio"
              style={[styles.moneyInput, { color: colors.text }]}
            />
          </View>
          <View style={styles.headerButtons}>
            <Pressable onPress={() => setServiceOpen(false)} style={[styles.smallBtn, { borderColor: colors.border }]}>
              <Text style={[styles.smallBtnText, { color: colors.text }]}>Cancelar servicio</Text>
            </Pressable>
            <Pressable
              onPress={addManualService}
              disabled={!serviceName.trim() || digits(serviceAmount) <= 0}
              style={[styles.smallBtn, { borderColor: palette.primary, backgroundColor: palette.primary, opacity: !serviceName.trim() || digits(serviceAmount) <= 0 ? 0.5 : 1 }]}>
              <Text style={[styles.smallBtnText, { color: '#fff' }]}>Agregar servicio</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Líneas */}
      {lines.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Ionicons name="cube-outline" size={24} color={colors.muted} />
          <Text style={[styles.small, styles.center, { color: colors.muted }]}>No hay repuestos ni servicios agregados a esta reparación.</Text>
        </View>
      ) : (
        lines.map((line, index) => (
          <LineCard
            key={line.key}
            line={line}
            colors={colors}
            canViewCost={canViewCost}
            allowLineDiscount={allowLineDiscount}
            onChange={(patch) => update(index, patch)}
            onRemove={() => onChange(lines.filter((_, i) => i !== index))}
          />
        ))
      )}
    </View>
  );
}

function LineCard({
  line,
  colors,
  canViewCost,
  allowLineDiscount,
  onChange,
  onRemove,
}: {
  line: BudgetLine;
  colors: Colors;
  canViewCost: boolean;
  allowLineDiscount: boolean;
  onChange: (patch: Partial<BudgetLine>) => void;
  onRemove: () => void;
}) {
  const quantity = digits(line.qtyText);
  const invalid = belowCost(line);
  const overStock = line.stock !== undefined && line.stock !== null && line.lineType === 'charged_part' && quantity > line.stock;
  const included = line.lineType === 'included_material';

  return (
    <View style={[styles.line, { borderColor: invalid ? palette.danger : colors.border, backgroundColor: invalid ? 'rgba(220,38,38,0.05)' : colors.card }]}>
      <View style={styles.lineHead}>
        <View style={styles.flex}>
          <View style={[styles.typeBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.typeText, { color: colors.muted }]}>{LINE_LABEL[line.lineType]}</Text>
          </View>
          {line.productId ? (
            <>
              <Text style={[styles.lineName, { color: colors.text }]}>{line.name}</Text>
              {line.partNumber ? <Text style={[styles.small, styles.mono, { color: colors.muted }]}>{line.partNumber}</Text> : null}
            </>
          ) : (
            <>
              <TextInput
                value={line.name}
                onChangeText={(name) => onChange({ name })}
                accessibilityLabel="Nombre del concepto manual"
                style={[styles.input, styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
              <Text style={[styles.tiny, { color: colors.muted }]}>Carga manual · no descuenta stock</Text>
            </>
          )}
          <Text style={[styles.small, { color: colors.muted }]}>
            {canViewCost && line.productId ? `Costo: ${formatGs(Number(line.unitCost) || 0)} · ` : ''}IVA: {line.taxRate ?? 10}%
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Eliminar ${line.name}`} style={styles.trash}>
          <Ionicons name="trash-outline" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={[styles.cellLabel, { color: colors.muted }]}>Cantidad</Text>
          <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Pressable onPress={() => onChange({ qtyText: String(Math.max(1, quantity - 1)) })} hitSlop={6} accessibilityLabel="Restar uno">
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>
            <TextInput
              value={line.qtyText}
              onChangeText={(value) => onChange({ qtyText: value.replace(/\D/g, '') })}
              keyboardType="number-pad"
              accessibilityLabel={`Cantidad de ${line.name}`}
              style={[styles.qty, { color: colors.text }]}
            />
            <Pressable onPress={() => onChange({ qtyText: String(quantity + 1) })} hitSlop={6} accessibilityLabel="Sumar uno">
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {canViewCost && !line.productId && (
          <MoneyCell label="Costo interno" value={line.costText} onChange={(costText) => onChange({ costText })} colors={colors} />
        )}

        <View style={styles.cell}>
          <Text style={[styles.cellLabel, { color: colors.muted }]}>Precio al cliente</Text>
          {included ? (
            <View style={[styles.includedBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.moneyInput, styles.mono, { color: colors.text }]}>{formatGs(0)}</Text>
              <Text style={[styles.tiny, { color: colors.muted }]}>Incluido</Text>
            </View>
          ) : (
            <MoneyField value={line.priceText} onChange={(priceText) => onChange({ priceText })} colors={colors} label={`Precio al cliente de ${line.name}`} />
          )}
        </View>

        {!included && allowLineDiscount && (
          <MoneyCell label="Descuento" value={line.discountText} onChange={(discountText) => onChange({ discountText })} colors={colors} />
        )}
      </View>

      {invalid && (
        <View style={styles.warn}>
          <Ionicons name="warning-outline" size={14} color={palette.danger} />
          <Text style={[styles.small, styles.bold, { color: palette.danger }]}>El precio queda debajo del costo de inventario.</Text>
        </View>
      )}
      {overStock && (
        <View style={styles.warn}>
          <Ionicons name="alert-circle-outline" size={14} color="#D97706" />
          <Text style={[styles.small, styles.bold, { color: '#D97706' }]}>Hay {line.stock} en stock: no alcanza para {quantity}.</Text>
        </View>
      )}

      <View style={[styles.lineFoot, { borderColor: colors.border }]}>
        <Text style={[styles.small, { color: colors.muted }]}>Subtotal línea:</Text>
        <Text style={[styles.subtotal, { color: colors.text }]}>{formatGs(lineSubtotal(line))}</Text>
      </View>
    </View>
  );
}

function MoneyField({ value, onChange, colors, label }: { value: string; onChange: (value: string) => void; colors: Colors; label: string }) {
  return (
    <View style={[styles.money, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Text style={[styles.small, { color: colors.muted }]}>Gs.</Text>
      <TextInput
        value={value}
        onChangeText={(next) => onChange(prettyAmount(next))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[styles.moneyInput, { color: colors.text }]}
      />
    </View>
  );
}

function MoneyCell({ label, value, onChange, colors }: { label: string; value: string; onChange: (value: string) => void; colors: Colors }) {
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: colors.muted }]}>{label}</Text>
      <MoneyField value={value} onChange={onChange} colors={colors} label={label} />
    </View>
  );
}

/** Montos rápidos para la mano de obra: un toque en vez de tipear ceros. */
export function QuickAmounts({ value, onPick, amounts = [50000, 100000, 150000, 200000, 300000] }: { value: number; onPick: (amount: number) => void; amounts?: number[] }) {
  const colors = usePalette();
  return (
    <View style={styles.quick}>
      {amounts.map((amount) => {
        const selected = value === amount;
        return (
          <Pressable
            key={amount}
            onPress={() => onPick(amount)}
            style={[styles.quickChip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.1)' : colors.background }]}>
            <Text style={[styles.quickText, { color: selected ? palette.primary : colors.text }]}>{(amount / 1000).toLocaleString('es-PY')}k</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  center: { textAlign: 'center' },
  strike: { textDecorationLine: 'line-through' },
  mono: { fontVariant: ['tabular-nums'] },
  alignEnd: { alignItems: 'flex-end' },
  wrap: { gap: 10 },
  label: { fontSize: 13, fontWeight: '800' },
  small: { fontSize: 12 },
  tiny: { fontSize: 10, marginTop: 2 },
  headerRow: { gap: 8 },
  headerButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  smallBtnText: { fontSize: 12, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, height: '100%' },
  results: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  resultName: { fontSize: 14, fontWeight: '800' },
  resultPrice: { fontSize: 14, fontWeight: '800' },
  serviceBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 18, alignItems: 'center', gap: 6 },
  line: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  lineHead: { flexDirection: 'row', gap: 8 },
  typeBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  typeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  lineName: { fontSize: 14, fontWeight: '800' },
  nameInput: { paddingVertical: 7, fontWeight: '600' },
  trash: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48.5%', flexGrow: 1, gap: 4 },
  cellLabel: { fontSize: 11, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 40 },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 15, fontWeight: '800' },
  money: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 40 },
  moneyInput: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  includedBox: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minHeight: 40, justifyContent: 'center' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lineFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  subtotal: { fontSize: 14, fontWeight: '900' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  quickText: { fontSize: 13, fontWeight: '700' },
});
