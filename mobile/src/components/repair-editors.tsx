import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { PatternPicker } from '@/components/pattern-picker';
import { BudgetLines, budgetProblem, fromBudgetLine, linesTotal, QuickAmounts, toBudgetLine, type BudgetLine } from '@/components/budget-editor';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  ACCESS_TYPES,
  DEVICE_ICONS,
  DEVICE_TYPES,
  validateRepairAccess,
  type AccessType,
  fetchCostHistory,
  FREQUENT_ISSUES,
  fetchTechnicians,
  isWholesale,
  money,
  newIdempotencyKey,
  PAY_METHODS,
  PRIORITY,
  registerRepairPayment,
  saveRepairCosts,
  updateRepair,
  type CostLine,
  type CostRevision,
  type PayMethod,
  type Repair,
  type RepairEdit,
  type Technician,
} from '@/lib/repairs';

type Colors = ReturnType<typeof usePalette>;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};
const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

// ─── Marco común de las hojas ──────────────────────────────────────────────

function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={`Cerrar ${title}`} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.small, { color: colors.muted }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Submit({ label, icon, onPress, disabled, saving, tone = palette.primary }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; saving: boolean; tone?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || saving} style={[styles.submit, { backgroundColor: tone, opacity: disabled || saving ? 0.55 : 1 }]}>
      {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={19} color="#fff" />}
      <Text style={styles.submitText}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, colors, children, hint }: { label: string; colors: Colors; children: React.ReactNode; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>{children}</View>
      {hint ? <Text style={[styles.small, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

function Chip({ label, icon, selected, onPress, colors, tone = palette.primary }: { label: string; icon?: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void; colors: Colors; tone?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? tone : colors.border, backgroundColor: selected ? `${tone}18` : colors.background }]}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? tone : colors.muted} /> : null}
      <Text style={[styles.chipText, { color: selected ? tone : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Editar datos ──────────────────────────────────────────────────────────

const toEdit = (repair: Repair): RepairEdit => ({
  deviceType: (repair.device_type as RepairEdit['deviceType']) || 'smartphone',
  brand: repair.device_brand ?? '',
  model: repair.device_model ?? '',
  imei: repair.imei ?? repair.serial_number ?? '',
  serialNumber: repair.serial_number ?? repair.imei ?? '',
  accessType: (repair.access_type as AccessType) || 'none',
  accessPassword: repair.access_password ?? '',
  issue: repair.problem_description ?? '',
  description: repair.diagnosis ?? '',
  priority: (repair.priority as RepairEdit['priority']) || 'medium',
  technicianId: repair.technician_id ?? null,
  warrantyMonths: Number(repair.warranty_months ?? 0) || 0,
});

export function EditRepairSheet({ repair, visible, onClose, onSaved }: { repair: Repair; visible: boolean; onClose: () => void; onSaved: (repair: Repair) => void }) {
  const colors = usePalette();
  const [edit, setEdit] = useState<RepairEdit>(() => toEdit(repair));
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanningImei, setScanningImei] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    fetchTechnicians()
      .then((rows) => active && setTechnicians(rows))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [visible]);

  const set = <K extends keyof RepairEdit>(key: K, value: RepairEdit[K]) => setEdit((current) => ({ ...current, [key]: value }));
  const accessError = validateRepairAccess(edit.accessType || 'none', edit.accessPassword);
  const problem =
    edit.brand.trim().length < 2
      ? 'Escribí la marca.'
      : !edit.model.trim()
        ? 'Escribí el modelo.'
        : !edit.issue.trim()
          ? 'Escribí el problema.'
          : accessError;

  const close = () => {
    if (saving) return;
    setEdit(toEdit(repair));
    setError(null);
    onClose();
  };

  const save = async () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRepair(repair.id, edit);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(updated);
    } catch (err) {
      setError(errorText(err, 'No se pudieron guardar los cambios.'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title="Editar reparación"
      subtitle="Equipo, problema, prioridad, técnico y garantía."
      onClose={close}
      footer={<Submit label="Guardar cambios" icon="save-outline" onPress={save} saving={saving} disabled={Boolean(problem)} />}>
      <Text style={[styles.label, { color: colors.text }]}>Tipo de equipo</Text>
      <View style={styles.chips}>
        {DEVICE_TYPES.map((type) => (
          <Chip key={type.key} label={type.label} icon={DEVICE_ICONS[type.key]} selected={edit.deviceType === type.key} onPress={() => set('deviceType', type.key)} colors={colors} />
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="Marca" colors={colors}>
            <TextInput value={edit.brand} onChangeText={(v) => set('brand', v)} style={[styles.input, { color: colors.text }]} />
          </Field>
        </View>
        <View style={styles.flex}>
          <Field label="Modelo" colors={colors}>
            <TextInput value={edit.model} onChangeText={(v) => set('model', v)} style={[styles.input, { color: colors.text }]} />
          </Field>
        </View>
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.text }]}>
            {edit.deviceType === 'smartphone' || edit.deviceType === 'tablet' ? 'IMEI' : 'N.º de serie'}
          </Text>
          {(edit.deviceType === 'smartphone' || edit.deviceType === 'tablet') && (edit.imei ?? '').trim().length > 0 && (
            <Text style={[styles.small, { color: (edit.imei ?? '').replace(/\D/g, '').length === 15 ? palette.success : colors.muted, fontWeight: '700' }]}>
              {(edit.imei ?? '').replace(/\D/g, '').length === 15 ? '✓ 15 dígitos (IMEI válido)' : `${(edit.imei ?? '').replace(/\D/g, '').length}/15 dígitos`}
            </Text>
          )}
        </View>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <TextInput
            value={edit.imei ?? ''}
            onChangeText={(v) => {
              const isPhoneOrTablet = edit.deviceType === 'smartphone' || edit.deviceType === 'tablet';
              const cleaned = isPhoneOrTablet ? v.replace(/[^\d\s-]/g, '') : v.toUpperCase();
              set('imei', cleaned);
              set('serialNumber', cleaned);
            }}
            placeholder={edit.deviceType === 'smartphone' || edit.deviceType === 'tablet' ? '352091081234567' : 'S/N de equipo'}
            placeholderTextColor={colors.muted}
            keyboardType={edit.deviceType === 'smartphone' || edit.deviceType === 'tablet' ? 'number-pad' : 'default'}
            autoCapitalize="characters"
            style={[styles.input, { color: colors.text }]}
          />
          <Pressable onPress={() => setScanningImei(true)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="camera-outline" size={20} color={palette.primary} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => setScanningImei(true)}
          style={[styles.cameraActionBtn, { borderColor: palette.primary, backgroundColor: `${palette.primary}12` }]}
          accessibilityLabel="Abrir cámara para escanear IMEI">
          <Ionicons name="camera" size={17} color={palette.primary} />
          <Ionicons name="barcode-outline" size={17} color={palette.primary} />
          <Text style={[styles.cameraActionText, { color: palette.primary }]}>
            {edit.deviceType === 'smartphone' || edit.deviceType === 'tablet' ? 'Escanear IMEI con la cámara' : 'Escanear número de serie'}
          </Text>
        </Pressable>
        <View style={[styles.tipBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
          <Text style={[styles.tipText, { color: colors.muted }]}>
            {edit.deviceType === 'smartphone' || edit.deviceType === 'tablet'
              ? 'Podés escanear la caja, la bandeja SIM, la etiqueta trasera o marcar *#06# en el celular para escanear el código de barras en pantalla.'
              : 'Podés escanear el código de barras o código QR que figura en la etiqueta o chasis del equipo.'}
          </Text>
        </View>
      </View>
      <Text style={[styles.label, { color: colors.text }]}>Problemas frecuentes</Text>
      <View style={styles.chips}>
        {FREQUENT_ISSUES.map((item) => (
          <Chip
            key={item.label}
            label={item.label}
            icon={item.icon}
            selected={edit.issue.includes(item.issue)}
            onPress={() => {
              const current = edit.issue.trim();
              if (current.includes(item.issue)) {
                const escaped = item.issue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const cleaned = current
                  .replace(new RegExp("\\.?\\s*" + escaped + "\\.?", "g"), "")
                  .replace(/^\s*\.\s*/, "")
                  .replace(/\.\s*\./g, ".")
                  .trim();
                set("issue", cleaned);
              } else {
                set("issue", current ? `${current.replace(/[.,]$/, "")}. ${item.issue}`.slice(0, 500) : item.issue);
              }
            }}
            colors={colors}
          />
        ))}
      </View>
      <Field label="Problema informado" colors={colors}>
        <TextInput value={edit.issue} onChangeText={(v) => set("issue", v)} multiline maxLength={500} style={[styles.input, styles.multiline, { color: colors.text }]} />
      </Field>
      <Field label="Diagnóstico" colors={colors}>
        <TextInput
          value={edit.description}
          onChangeText={(v) => set('description', v)}
          multiline
          maxLength={1000}
          placeholder="Qué encontró el técnico"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multiline, { color: colors.text }]}
        />
      </Field>

      <Text style={[styles.label, { color: colors.text }]}>Desbloqueo del equipo</Text>
      <View style={styles.chips}>
        {ACCESS_TYPES.map((type) => {
          const isSelected = (edit.accessType || 'none') === type.key;
          return (
            <Chip
              key={type.key}
              label={type.label}
              icon={type.icon}
              selected={isSelected}
              onPress={() => {
                set('accessType', type.key);
                if (type.key === 'none' || type.key === 'biometric') {
                  set('accessPassword', '');
                } else if (type.key === 'pin') {
                  set('accessPassword', (edit.accessPassword ?? '').replace(/[^\d\s,/-]/g, ''));
                }
              }}
              colors={colors}
              tone={isSelected ? type.color : undefined}
            />
          );
        })}
      </View>

      {edit.accessType === 'none' && (
        <View style={[styles.tipBox, { backgroundColor: '#16A34A12', borderColor: '#16A34A44' }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
          <Text style={[styles.tipText, { color: colors.text }]}>
            El equipo no tiene bloqueo y se puede acceder libremente para pruebas.
          </Text>
        </View>
      )}

      {edit.accessType === 'biometric' && (
        <View style={[styles.tipBox, { backgroundColor: '#D9770612', borderColor: '#D9770644' }]}>
          <Ionicons name="finger-print-outline" size={18} color="#D97706" />
          <Text style={[styles.tipText, { color: colors.text }]}>
            Acceso biométrico: El cliente deberá estar presente para desbloquear o deshabilitar temporalmente la protección.
          </Text>
        </View>
      )}

      {edit.accessType === 'pin' && (
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.text }]}>PIN numérico</Text>
            {(edit.accessPassword ?? '').trim().length > 0 && (
              <Text
                style={[
                  styles.small,
                  {
                    color: /^[\d\s,/-]+$/.test((edit.accessPassword ?? '').trim()) ? palette.success : palette.danger,
                    fontWeight: '700',
                  },
                ]}>
                {/^[\d\s,/-]+$/.test((edit.accessPassword ?? '').trim()) ? '✓ PIN válido' : 'Solo números'}
              </Text>
            )}
          </View>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              value={edit.accessPassword ?? ''}
              onChangeText={(v) => set('accessPassword', v)}
              placeholder="Ej: 1234, 0000"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: colors.text }]}
            />
            <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={8} style={{ padding: 6 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}

      {edit.accessType === 'password' && (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Contraseña alfanumérica</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              value={edit.accessPassword ?? ''}
              onChangeText={(v) => set('accessPassword', v)}
              placeholder="Ej: MiClave123"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: colors.text }]}
            />
            <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={8} style={{ padding: 6 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}

      {edit.accessType === 'pattern' && (
        <PatternPicker
          value={edit.accessPassword ?? ''}
          onChange={(val) => set('accessPassword', val)}
          error={accessError}
        />
      )}

      {edit.accessType === 'other' && (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Descripción de acceso</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              value={edit.accessPassword ?? ''}
              onChangeText={(v) => set('accessPassword', v)}
              placeholder="Ej: Presionar botón 2 veces o clave en etiqueta"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={200}
              style={[styles.input, styles.multiline, { color: colors.text }]}
            />
          </View>
        </View>
      )}

      <Text style={[styles.label, { color: colors.text }]}>Prioridad</Text>
      <View style={styles.chips}>
        {(['low', 'medium', 'high'] as const).map((key) => (
          <Chip key={key} label={PRIORITY[key].label} selected={edit.priority === key} onPress={() => set('priority', key)} colors={colors} tone={key === 'high' ? palette.danger : palette.primary} />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Técnico</Text>
      {technicians.length === 0 ? (
        <Text style={[styles.small, { color: colors.muted }]}>Cargando técnicos…</Text>
      ) : (
        <View style={styles.chips}>
          {technicians.map((tech) => (
            <Chip key={tech.id} label={tech.name || 'Técnico'} icon="person-outline" selected={edit.technicianId === tech.id} onPress={() => set('technicianId', tech.id)} colors={colors} />
          ))}
        </View>
      )}

      <Text style={[styles.label, { color: colors.text }]}>Garantía</Text>
      <View style={styles.chips}>
        {[0, 1, 3, 6, 12].map((months) => (
          <Chip
            key={months}
            label={months === 0 ? 'Sin garantía' : `${months} ${months === 1 ? 'mes' : 'meses'}`}
            selected={edit.warrantyMonths === months}
            onPress={() => set('warrantyMonths', months)}
            colors={colors}
          />
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <BarcodeScanner
        visible={scanningImei}
        onClose={() => setScanningImei(false)}
        title={edit.deviceType === 'smartphone' || edit.deviceType === 'tablet' ? 'Escanear IMEI del equipo' : 'Escanear número de serie'}
        hint="Apuntá la cámara a la caja, etiqueta trasera o pantalla (*#06#)"
        onScanned={(code: string) => {
          setScanningImei(false);
          const isPhoneOrTablet = edit.deviceType === 'smartphone' || edit.deviceType === 'tablet';
          const cleaned = isPhoneOrTablet ? code.replace(/\D/g, '').slice(0, 15) : code.trim();
          set('imei', cleaned);
          set('serialNumber', cleaned);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </Sheet>
  );
}

// ─── Costos ────────────────────────────────────────────────────────────────

const linesFrom = (repair: Repair): BudgetLine[] =>
  (repair.parts ?? []).map((part) =>
    toBudgetLine({
      name: part.part_name,
      quantity: Number(part.quantity) || 1,
      unitPrice: Number(part.unit_price) || 0,
      productId: part.product_id ?? null,
      partNumber: part.part_number ?? null,
      supplier: part.supplier ?? null,
      unitCost: part.unit_cost ?? null,
      discountAmount: Number(part.discount_amount ?? 0) || 0,
      taxRate: ([0, 5, 10].includes(Number(part.tax_rate)) ? Number(part.tax_rate) : 10) as 0 | 5 | 10,
      lineType: (part.line_type as CostLine['lineType']) || 'charged_part',
    })
  );

const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Precio y presupuesto. Arriba se ve el total actual contra el nuevo, para que
 * un cambio de precio nunca pase sin que se note; abajo, el historial de cada
 * vez que se guardó (quién, cuándo y por qué), igual que en la web.
 */
export function CostsSheet({ repair, visible, onClose, onSaved }: { repair: Repair; visible: boolean; onClose: () => void; onSaved: (repair: Repair) => void }) {
  const colors = usePalette();
  const { data: panel } = usePanel();
  const current = money(repair);
  const [labor, setLabor] = useState(() => pretty(Number(repair.labor_cost ?? 0)));
  const [lines, setLines] = useState<BudgetLine[]>(() => linesFrom(repair));
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [discount, setDiscount] = useState(() => pretty(Number(repair.discount_amount ?? 0)));
  const [extra, setExtra] = useState('');
  const [reason, setReason] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [history, setHistory] = useState<CostRevision[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    fetchCostHistory(repair.id)
      .then((rows) => active && setHistory(rows))
      .catch(() => active && setHistory([]));
    return () => {
      active = false;
    };
  }, [visible, repair.id]);

  const laborAmount = digits(labor);
  const partsTotal = linesTotal(lines);
  const extraAmount = digits(extra);
  const subtotal = laborAmount + partsTotal + extraAmount;
  const percent = Math.min(100, digits(discount));
  const discountAmount = discountMode === 'percent' ? Math.round((subtotal * percent) / 100) : digits(discount);
  const total = Math.max(0, subtotal - discountAmount);
  const difference = total - current.total;
  const changed = difference !== 0 || lines.length !== (repair.parts?.length ?? 0);
  const overpaid = current.paid > total;
  const invalid = budgetProblem(lines) ?? (discountAmount > subtotal ? 'El descuento no puede superar el total.' : null);

  const close = () => {
    if (saving) return;
    setLabor(pretty(Number(repair.labor_cost ?? 0)));
    setLines(linesFrom(repair));
    setDiscount(pretty(Number(repair.discount_amount ?? 0)));
    setDiscountMode('amount');
    setExtra('');
    setReason('');
    setError(null);
    onClose();
  };

  const save = async () => {
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
    try {
      const updated = await saveRepairCosts(
        repair.id,
        { laborAmount, discountAmount, additionalCharges: extraAmount, parts: lines.map(fromBudgetLine), reason },
        key
      );
      setKey(newIdempotencyKey());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(updated);
    } catch (err) {
      setError(errorText(err, 'No se pudieron guardar los costos.'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title="Precio y presupuesto"
      subtitle="Mano de obra, repuestos y descuento. Cada cambio queda en el historial."
      onClose={close}
      footer={
        <View style={styles.footer}>
          {/* Total actual → nuevo */}
          <View style={[styles.compare, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.flex}>
              <Text style={[styles.small, { color: colors.muted }]}>{current.quoted ? 'Total actual' : 'Sin precio'}</Text>
              <Text style={[styles.oldTotal, { color: colors.muted }]}>{current.quoted ? formatGs(current.total) : '—'}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.muted} />
            <View style={[styles.flex, styles.alignEnd]}>
              <Text style={[styles.small, { color: colors.muted }]}>Nuevo total</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{formatGs(total)}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            {difference !== 0 && current.quoted && (
              <View style={[styles.diff, { backgroundColor: difference > 0 ? '#DC26261A' : '#16A34A1A' }]}>
                <Ionicons name={difference > 0 ? 'trending-up' : 'trending-down'} size={13} color={difference > 0 ? palette.danger : palette.success} />
                <Text style={[styles.diffText, { color: difference > 0 ? palette.danger : palette.success }]}>
                  {difference > 0 ? '+' : '−'} {formatGs(Math.abs(difference))}
                </Text>
              </View>
            )}
            {current.paid > 0 && (
              <Text style={[styles.small, styles.flex, { color: overpaid ? '#D97706' : colors.muted }]}>
                {overpaid
                  ? `Ya pagó ${formatGs(current.paid)}: más que el nuevo total.`
                  : `Pagó ${formatGs(current.paid)} · saldo ${formatGs(total - current.paid)}`}
              </Text>
            )}
          </View>
          <Submit label={changed ? 'Guardar nuevo precio' : 'Guardar'} icon="save-outline" onPress={save} saving={saving} disabled={Boolean(invalid)} />
        </View>
      }>
      {/* Mano de obra */}
      <View style={[styles.block, { borderColor: colors.border }]}>
        <View style={styles.blockHead}>
          <Ionicons name="construct-outline" size={16} color={palette.primary} />
          <Text style={[styles.blockTitle, { color: colors.text }]}>Mano de obra</Text>
          <Text style={[styles.blockAmount, { color: colors.text }]}>{formatGs(laborAmount)}</Text>
        </View>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
          <TextInput value={labor} onChangeText={(v) => setLabor(pretty(v))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} accessibilityLabel="Mano de obra" style={[styles.input, { color: colors.text }]} />
          {labor ? (
            <Pressable onPress={() => setLabor('')} hitSlop={8} accessibilityLabel="Borrar mano de obra">
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <QuickAmounts value={laborAmount} onPick={(amount) => setLabor(pretty(amount))} />
      </View>

      {/* Repuestos */}
      <View style={[styles.block, { borderColor: colors.border }]}>
        <View style={styles.blockHead}>
          <Ionicons name="cube-outline" size={16} color={palette.primary} />
          <Text style={[styles.blockTitle, { color: colors.text }]}>Repuestos y servicios ({lines.length})</Text>
          <Text style={[styles.blockAmount, { color: colors.text }]}>{formatGs(partsTotal)}</Text>
        </View>
        <BudgetLines
          lines={lines}
          onChange={setLines}
          repairId={repair.id}
          customerIsWholesale={repair.customer ? isWholesale(repair.customer) : false}
          canViewCost={Boolean(panel?.user.isAdmin)}
        />
      </View>

      {/* Descuento */}
      <View style={[styles.block, { borderColor: colors.border }]}>
        <View style={styles.blockHead}>
          <Ionicons name="pricetag-outline" size={16} color={palette.primary} />
          <Text style={[styles.blockTitle, { color: colors.text }]}>Descuento</Text>
          <Text style={[styles.blockAmount, { color: discountAmount > 0 ? palette.danger : colors.muted }]}>
            {discountAmount > 0 ? `− ${formatGs(discountAmount)}` : 'Sin descuento'}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={[styles.segment, { borderColor: colors.border }]}>
            {(['amount', 'percent'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => {
                  setDiscountMode(mode);
                  setDiscount('');
                }}
                style={[styles.segmentItem, discountMode === mode && { backgroundColor: palette.primary }]}>
                <Text style={[styles.segmentText, { color: discountMode === mode ? '#fff' : colors.text }]}>{mode === 'amount' ? 'Gs.' : '%'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.inputWrap, styles.flex, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              value={discount}
              onChangeText={(v) => setDiscount(discountMode === 'percent' ? String(Math.min(100, digits(v)) || '') : pretty(v))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Descuento"
              style={[styles.input, { color: colors.text }]}
            />
            {discountMode === 'percent' && <Text style={[styles.prefix, { color: colors.muted }]}>%</Text>}
          </View>
        </View>
        {discountMode === 'percent' && (
          <View style={styles.chipsRow}>
            {[5, 10, 15, 20].map((value) => (
              <Chip key={value} label={`${value}%`} selected={percent === value} onPress={() => setDiscount(String(value))} colors={colors} />
            ))}
          </View>
        )}
      </View>

      {/* Más opciones */}
      <Pressable onPress={() => setShowMore((value) => !value)} style={styles.moreToggle} hitSlop={6}>
        <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={palette.primary} />
        <Text style={[styles.moreText, { color: palette.primary }]}>{showMore ? 'Menos opciones' : 'Cargo extra y motivo del cambio'}</Text>
      </Pressable>
      {showMore && (
        <>
          <Field label="Cargo extra (envío, urgencia…)" colors={colors}>
            <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
            <TextInput value={extra} onChangeText={(v) => setExtra(pretty(v))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} />
          </Field>
          <Field label="Motivo del cambio (queda en el historial)" colors={colors}>
            <TextInput value={reason} onChangeText={setReason} maxLength={500} placeholder="El cliente aprobó cambiar también la batería" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} />
          </Field>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Historial */}
      {history && history.length > 0 && (
        <View style={[styles.block, { borderColor: colors.border }]}>
          <Pressable onPress={() => setShowHistory((value) => !value)} style={styles.blockHead}>
            <Ionicons name="time-outline" size={16} color={palette.primary} />
            <Text style={[styles.blockTitle, { color: colors.text }]}>Historial de precios ({history.length})</Text>
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
          </Pressable>
          {showHistory &&
            history.slice(0, 8).map((revision, index) => (
              <View key={revision.id} style={[styles.revision, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                <View style={styles.flex}>
                  <Text style={[styles.revisionTitle, { color: colors.text }]}>
                    #{revision.revision_number} · {formatGs(Number(revision.final_total) || 0)}
                  </Text>
                  <Text style={[styles.small, { color: colors.muted }]}>
                    {shortDateTime(revision.created_at)}
                    {revision.actor_name ? ` · ${revision.actor_name}` : ''}
                  </Text>
                  {revision.reason ? <Text style={[styles.small, { color: colors.text }]}>«{revision.reason}»</Text> : null}
                </View>
                <Text style={[styles.small, { color: colors.muted }]}>
                  MO {formatGs(Number(revision.labor_amount) || 0)}
                </Text>
              </View>
            ))}
        </View>
      )}
    </Sheet>
  );
}

// ─── Pago / anticipo ───────────────────────────────────────────────────────

export function PaymentSheet({ repair, visible, onClose, onSaved }: { repair: Repair; visible: boolean; onClose: () => void; onSaved: (repair: Repair) => void }) {
  const colors = usePalette();
  const { balance, quoted } = money(repair);
  // Sin precio todavía, lo que se recibe es un anticipo (la API lo exige así).
  const purpose: 'payment' | 'deposit' = quoted ? 'payment' : 'deposit';
  const [method, setMethod] = useState<PayMethod>('cash');
  const [amount, setAmount] = useState(() => (balance > 0 ? pretty(balance) : ''));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [key, setKey] = useState(newIdempotencyKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = digits(amount);
  const needsReference = method === 'card' || method === 'transfer';
  const problem =
    value <= 0
      ? 'Escribí el monto.'
      : purpose === 'payment' && value > balance
        ? `El saldo es ${formatGs(balance)}: no se puede cobrar más.`
        : needsReference && !reference.trim()
          ? 'Anotá la referencia del comprobante.'
          : null;

  const close = () => {
    if (saving) return;
    setAmount(balance > 0 ? pretty(balance) : '');
    setReference('');
    setNote('');
    setError(null);
    onClose();
  };

  const save = async () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const updated = await registerRepairPayment(repair.id, { method, amount: value, reference, note, purpose }, key);
      setKey(newIdempotencyKey());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(updated);
    } catch (err) {
      setError(errorText(err, 'No se pudo registrar el pago.'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={purpose === 'deposit' ? 'Registrar anticipo' : 'Registrar pago'}
      subtitle={purpose === 'deposit' ? 'Todavía no tiene precio: lo que pague queda como anticipo.' : `Saldo pendiente: ${formatGs(balance)}`}
      onClose={close}
      footer={
        <Submit
          label={value > 0 ? `${purpose === 'deposit' ? 'Registrar anticipo de' : 'Cobrar'} ${formatGs(value)}` : 'Registrar'}
          icon="cash-outline"
          onPress={save}
          saving={saving}
          disabled={Boolean(problem)}
          tone="#16A34A"
        />
      }>
      <View style={styles.chips}>
        {PAY_METHODS.map((item) => (
          <Chip key={item.key} label={item.label} icon={item.icon} selected={method === item.key} onPress={() => setMethod(item.key)} colors={colors} />
        ))}
      </View>
      <Field label="Monto" colors={colors}>
        <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
        <TextInput value={amount} onChangeText={(v) => setAmount(pretty(v))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} />
        {amount ? (
          <Pressable onPress={() => setAmount('')} hitSlop={8} accessibilityLabel="Borrar monto">
            <Ionicons name="close-circle" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </Field>
      {balance > 0 && (
        <View style={styles.chipsRow}>
          <Pressable
            onPress={() => setAmount(pretty(balance))}
            style={[styles.chip, { backgroundColor: '#16A34A18', borderColor: '#16A34A' }]}>
            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
            <Text style={[styles.chipText, { color: '#16A34A', fontWeight: '800' }]}>
              Cobrar saldo total: {formatGs(balance)}
            </Text>
          </Pressable>
        </View>
      )}
      <View style={[styles.chipsRow, { marginTop: 4 }]}>
        {[20000, 50000, 100000].map((preset) => (
          <Pressable
            key={preset}
            onPress={() => setAmount(pretty(preset))}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.chipText, { color: colors.text, fontWeight: '700' }]}>+{formatGs(preset)}</Text>
          </Pressable>
        ))}
      </View>
      {needsReference && (
        <Field label={method === 'card' ? 'N.º de comprobante (voucher)' : 'Referencia de la transferencia'} colors={colors}>
          <TextInput value={reference} onChangeText={setReference} autoCapitalize="characters" style={[styles.input, { color: colors.text }]} />
        </Field>
      )}
      <Field label="Nota (opcional)" colors={colors}>
        <TextInput value={note} onChangeText={setNote} maxLength={2000} style={[styles.input, { color: colors.text }]} />
      </Field>
      <Text style={[styles.small, { color: colors.muted }]}>En efectivo o tarjeta tiene que haber una caja abierta en la sucursal.</Text>
      {error && <Text style={styles.error}>{error}</Text>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.45)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '800' },
  small: { fontSize: 12, marginTop: 2 },
  body: { gap: 12, paddingBottom: 12 },
  label: { fontSize: 13, fontWeight: '800' },
  field: { gap: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontSize: 15, fontWeight: '700' },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
  part: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  partName: { flex: 1, fontSize: 15, fontWeight: '700', paddingVertical: 4 },
  mini: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 74 },
  miniInput: { fontSize: 15, fontWeight: '700', paddingVertical: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, minHeight: 46 },
  addText: { fontSize: 14, fontWeight: '800' },
  footer: { gap: 8 },
  alignEnd: { alignItems: 'flex-end' },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  oldTotal: { fontSize: 15, fontWeight: '700', textDecorationLine: 'line-through' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  diff: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  diffText: { fontSize: 12, fontWeight: '800' },
  block: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  blockAmount: { fontSize: 14, fontWeight: '800' },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segmentItem: { paddingHorizontal: 14, paddingVertical: 11 },
  segmentText: { fontSize: 14, fontWeight: '800' },
  chipsRow: { flexDirection: 'row', gap: 6 },
  moreToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreText: { fontSize: 13, fontWeight: '800' },
  revision: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  revisionTitle: { fontSize: 14, fontWeight: '800' },
  breakdown: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 3 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalValue: { fontSize: 20, fontWeight: '900' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, minHeight: 52, marginTop: 4 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cameraActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  cameraActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
