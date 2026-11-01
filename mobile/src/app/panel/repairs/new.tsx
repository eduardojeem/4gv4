import { PanelAccessState } from '@/components/panel-access-state';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { CustomerPicker } from '@/components/customer-picker';
import { BudgetLines, budgetProblem, fromBudgetLine, linesTotal, QuickAmounts, type BudgetLine } from '@/components/budget-editor';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  ACCESS_TYPES,
  createRepair,
  DEVICE_ICONS,
  DEVICE_TYPES,
  fetchDeviceOptions,
  fetchTechnicians,
  isWholesale,
  FREQUENT_ISSUES,
  KNOWN_BRANDS,
  newIdempotencyKey,
  PRIORITY,
  rememberRepairs,
  type NewRepairInput,
  type RepairCustomer,
  type DeviceOptions,
  type Technician,
} from '@/lib/repairs';

type Colors = ReturnType<typeof usePalette>;

/** Solo dígitos: el presupuesto se escribe como «150000» o «150.000». */
const parseAmount = (value: string) => Number(value.replace(/\D/g, '')) || 0;
/** Suma un problema frecuente al texto (sin repetirlo) respetando el máximo de 200 caracteres. */
const toggleIssue = (current: string, issue: string) => {
  const text = current.trim();
  if (!text) return issue;
  if (text.includes(issue)) {
    const escaped = issue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cleaned = text
      .replace(new RegExp("\\.?\\s*" + escaped + "\\.?", "g"), "")
      .replace(/^\s*\.\s*/, "")
      .replace(/\.\s*\./g, ".")
      .trim();
    return cleaned;
  }
  return `${text.replace(/[.,]$/, "")}. ${issue}`.slice(0, 500);
};

const formatAmount = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('es-PY') : '';
};

export default function NewRepairScreen() {
  const colors = usePalette();
  const { data: panel, can } = usePanel();

  // Cliente
  const [customer, setCustomer] = useState<RepairCustomer | null>(null);
  // Equipo y trabajo
  const [deviceType, setDeviceType] = useState<NewRepairInput['device_type']>('smartphone');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [imei, setImei] = useState('');
  const [problem, setProblem] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [accessType, setAccessType] = useState<NewRepairInput['access_type']>('none');
  const [accessPassword, setAccessPassword] = useState('');
  const [priority, setPriority] = useState<NewRepairInput['priority']>('medium');
  const [labor, setLabor] = useState('');
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [devices, setDevices] = useState<DeviceOptions>({ brands: KNOWN_BRANDS, modelsByBrand: {} });
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [technicianId, setTechnicianId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [touched, setTouched] = useState(false);
  const [scanningImei, setScanningImei] = useState(false);

  useEffect(() => {
    fetchTechnicians().then(setTechnicians).catch(() => setTechnicians([]));
    fetchDeviceOptions().then(setDevices).catch(() => undefined);
  }, []);

  const needsPassword = accessType !== 'none';
  const problems = {
    customer: !customer ? 'Elegí o creá el cliente.' : null,
    brand: brand.trim().length < 2 ? 'Escribí la marca (mínimo 2 letras).' : null,
    model: !model.trim() ? 'Escribí el modelo.' : null,
    problem: !problem.trim() ? 'Contá qué le pasa al equipo.' : null,
    access: needsPassword && !accessPassword.trim() ? 'Anotá el dato de desbloqueo.' : null,
  };
  const budgetTotal = parseAmount(labor) + linesTotal(lines);
  const firstProblem = Object.values(problems).find(Boolean) ?? budgetProblem(lines);

  // Marcas: primero las que ya usa el comercio; modelos de esa marca que coinciden con lo escrito.
  const brandChips = devices.brands.slice(0, 12);
  const brandKey = Object.keys(devices.modelsByBrand).find((key) => key.toLowerCase() === brand.trim().toLowerCase());
  const modelChips = (brandKey ? devices.modelsByBrand[brandKey] : [])
    .filter((option) => option.toLowerCase().includes(model.trim().toLowerCase()) && option.toLowerCase() !== model.trim().toLowerCase())
    .slice(0, 10);

  const submit = async () => {
    setTouched(true);
    if (firstProblem || !customer) {
      setError(firstProblem);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const repair = await createRepair(
        {
          customer_id: customer.id,
          device_type: deviceType,
          device_brand: brand,
          device_model: model,
          imei: deviceType === 'smartphone' || deviceType === 'tablet' ? imei : undefined,
          serial_number: deviceType === 'smartphone' || deviceType === 'tablet' ? undefined : imei,
          problem_description: problem,
          diagnosis,
          access_type: accessType,
          access_password: accessPassword,
          priority,
          // El presupuesto es la mano de obra más los repuestos que se cobran.
          estimated_cost: budgetTotal,
          labor_cost: parseAmount(labor),
          parts: lines.map(fromBudgetLine),
          technician_id: technicianId,
        },
        idempotencyKey
      );
      rememberRepairs([repair]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/panel/repairs/${repair.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la reparación.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const show = (key: keyof typeof problems) => (touched ? problems[key] : null);
  const serialLabel = deviceType === 'smartphone' || deviceType === 'tablet' ? 'IMEI (opcional)' : 'N.º de serie (opcional)';

  if (!can('repairs.orders.create')) return <PanelAccessState />;

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/panel/repairs' as never))} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>Nueva reparación</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* 1. Cliente */}
          <Section number={1} title="Cliente" colors={colors} error={show('customer')}>
            <CustomerPicker value={customer} onChange={setCustomer} error={show('customer')} />
          </Section>

          {/* 2. Equipo */}
          <Section number={2} title="Equipo" colors={colors} error={show('brand') || show('model')}>
            <View style={styles.chips}>
              {DEVICE_TYPES.map((type) => (
                <Chip
                  key={type.key}
                  label={type.label}
                  icon={DEVICE_ICONS[type.key]}
                  selected={deviceType === type.key}
                  onPress={() => setDeviceType(type.key)}
                  colors={colors}
                />
              ))}
            </View>
            <Input label="Marca" value={brand} onChangeText={setBrand} placeholder="Samsung" colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hChips} keyboardShouldPersistTaps="handled">
              {brandChips.map((option) => (
                <Chip key={option} label={option} selected={brand.trim().toLowerCase() === option.toLowerCase()} onPress={() => setBrand(option)} colors={colors} />
              ))}
            </ScrollView>
            <Input label="Modelo" value={model} onChangeText={setModel} placeholder="Galaxy A54" colors={colors} />
            {modelChips.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hChips} keyboardShouldPersistTaps="handled">
                {modelChips.map((option) => (
                  <Chip key={option} label={option} selected={false} onPress={() => setModel(option)} colors={colors} />
                ))}
              </ScrollView>
            )}
            {/* Input con escáner de código de barras y contador de 15 dígitos */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text }]}>{serialLabel}</Text>
                {(deviceType === 'smartphone' || deviceType === 'tablet') && imei.trim().length > 0 && (
                  <Text style={[styles.small, { color: imei.replace(/\D/g, '').length === 15 ? palette.success : colors.muted, fontWeight: '700' }]}>
                    {imei.replace(/\D/g, '').length === 15 ? '✓ 15 dígitos (IMEI válido)' : `${imei.replace(/\D/g, '').length}/15 dígitos`}
                  </Text>
                )}
              </View>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  value={imei}
                  onChangeText={(v) => setImei(deviceType === 'smartphone' || deviceType === 'tablet' ? v.replace(/[^\d\s-]/g, '') : v.toUpperCase())}
                  placeholder={deviceType === 'smartphone' || deviceType === 'tablet' ? '352091081234567' : 'S/N de equipo'}
                  placeholderTextColor={colors.muted}
                  keyboardType={deviceType === 'smartphone' || deviceType === 'tablet' ? 'number-pad' : 'default'}
                  autoCapitalize="characters"
                  accessibilityLabel={serialLabel}
                  style={[styles.input, { color: colors.text }]}
                />
                <Pressable
                  onPress={() => setScanningImei(true)}
                  hitSlop={8}
                  style={{ padding: 6 }}
                  accessibilityLabel="Escanear código de barras o IMEI">
                  <Ionicons name="barcode-outline" size={22} color={palette.primary} />
                </Pressable>
              </View>
            </View>
          </Section>

          {/* 3. Problema */}
          <Section number={3} title="Problema" colors={colors} error={show('problem')}>
            <View style={styles.chips}>
              {FREQUENT_ISSUES.map((item) => (
                <Chip
                  key={item.label}
                  label={item.label}
                  icon={item.icon}
                  selected={problem.includes(item.issue)}
                  onPress={() => setProblem((current) => toggleIssue(current, item.issue))}
                  colors={colors}
                />
              ))}
            </View>
            <Input
              label="¿Qué le pasa?"
              value={problem}
              onChangeText={setProblem}
              placeholder="No carga, pantalla rota, se moja…"
              colors={colors}
              multiline
              maxLength={500}
              counter
            />
            <Input label="Diagnóstico inicial (opcional)" value={diagnosis} onChangeText={setDiagnosis} colors={colors} multiline maxLength={1000} />
          </Section>

          {/* 4. Desbloqueo */}
          <Section number={4} title="Desbloqueo del equipo" colors={colors} error={show('access')}>
            <View style={styles.chips}>
              {ACCESS_TYPES.map((type) => (
                <Chip key={type.key} label={type.label} selected={accessType === type.key} onPress={() => setAccessType(type.key)} colors={colors} />
              ))}
            </View>
            {needsPassword && (
              <Input
                label={accessType === 'pattern' ? 'Patrón (ej. 1-4-7-8-9)' : accessType === 'pin' ? 'PIN' : 'Contraseña'}
                value={accessPassword}
                onChangeText={setAccessPassword}
                colors={colors}
                keyboardType={accessType === 'password' ? 'default' : 'number-pad'}
                autoCapitalize="none"
              />
            )}
          </Section>

          {/* 5. Presupuesto */}
          <Section number={5} title="Presupuesto (opcional)" colors={colors} error={touched ? budgetProblem(lines) : null}>
            <Input
              label="Mano de obra"
              value={labor}
              onChangeText={(value) => setLabor(formatAmount(value))}
              placeholder="0"
              colors={colors}
              keyboardType="number-pad"
              prefix="Gs."
            />
            <QuickAmounts value={parseAmount(labor)} onPick={(amount) => setLabor(formatAmount(String(amount)))} />
            <Text style={[styles.label, { color: colors.text }]}>Repuestos y servicios</Text>
            <BudgetLines
              lines={lines}
              onChange={setLines}
              customerIsWholesale={customer ? isWholesale(customer) : false}
              canViewCost={Boolean(panel?.user.isAdmin)}
              allowLineDiscount={false}
            />
            <View style={[styles.budgetTotal, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.muted }]}>Total presupuestado</Text>
              <Text style={[styles.budgetValue, { color: budgetTotal > 0 ? colors.text : colors.muted }]}>
                {budgetTotal > 0 ? formatGs(budgetTotal) : 'A presupuestar'}
              </Text>
            </View>
          </Section>

          {/* 6. Prioridad y técnico */}
          <Section number={6} title="Prioridad y técnico" colors={colors}>
            <View style={styles.chips}>
              {(['low', 'medium', 'high'] as const).map((key) => (
                <Chip key={key} label={PRIORITY[key].label} selected={priority === key} onPress={() => setPriority(key)} colors={colors} tone={key === 'high' ? palette.danger : undefined} />
              ))}
            </View>
            {technicians.length > 0 && (
              <View style={styles.stack}>
                <Text style={[styles.label, { color: colors.text }]}>Técnico (opcional)</Text>
                <View style={styles.chips}>
                  <Chip label="Sin asignar" selected={!technicianId} onPress={() => setTechnicianId(null)} colors={colors} />
                  {technicians.map((tech) => (
                    <Chip key={tech.id} label={tech.name || 'Técnico'} selected={technicianId === tech.id} onPress={() => setTechnicianId(tech.id)} colors={colors} />
                  ))}
                </View>
              </View>
            )}
          </Section>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={palette.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable onPress={submit} disabled={saving} style={[styles.submit, { opacity: saving ? 0.7 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            <Text style={styles.submitText}>{saving ? 'Creando…' : 'Crear orden de reparación'}</Text>
          </Pressable>
        </View>
        <BarcodeScanner
          visible={scanningImei}
          onClose={() => setScanningImei(false)}
          onScanned={(code: string) => {
            setScanningImei(false);
            const cleaned = deviceType === 'smartphone' || deviceType === 'tablet' ? code.replace(/\D/g, '').slice(0, 15) : code.trim();
            setImei(cleaned);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

function Section({ number, title, colors, error, children }: { number: number; title: string; colors: Colors; error?: string | null; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: error ? palette.danger : colors.border }]}>
      <View style={styles.sectionHead}>
        <View style={[styles.number, { backgroundColor: palette.primary }]}>
          <Text style={styles.numberText}>{number}</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function Chip({ label, icon, selected, onPress, colors, tone }: { label: string; icon?: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void; colors: Colors; tone?: string }) {
  const color = tone ?? palette.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? color : colors.border, backgroundColor: selected ? `${color}18` : colors.background }]}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? color : colors.muted} /> : null}
      <Text style={[styles.chipText, { color: selected ? color : colors.text }, selected && styles.bold]}>{label}</Text>
    </Pressable>
  );
}

function Input({
  label,
  colors,
  counter,
  prefix,
  maxLength,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; colors: Colors; counter?: boolean; prefix?: string }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {counter && maxLength ? <Text style={[styles.small, { color: colors.muted }]}>{String(props.value ?? '').length}/{maxLength}</Text> : null}
      </View>
      <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {prefix ? <Text style={[styles.prefix, { color: colors.muted }]}>{prefix}</Text> : null}
        <TextInput
          {...props}
          maxLength={maxLength}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          style={[styles.input, { color: colors.text }, multiline && styles.multiline]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10 },
  stack: { gap: 8 },
  small: { fontSize: 12 },
  link: { fontSize: 14, fontWeight: '700' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  fieldError: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 10 },
  selectedName: { fontSize: 15, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  resultName: { fontSize: 15, fontWeight: '700' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, minHeight: 46, paddingHorizontal: 12 },
  btnText: { fontSize: 14, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hChips: { gap: 8, paddingRight: 8 },
  budgetTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  budgetValue: { fontSize: 18, fontWeight: '900' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontSize: 15, fontWeight: '700', marginRight: 6 },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, backgroundColor: 'rgba(220,38,38,0.1)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.35)' },
  errorText: { flex: 1, color: palette.danger, fontSize: 14, fontWeight: '600' },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 54 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
