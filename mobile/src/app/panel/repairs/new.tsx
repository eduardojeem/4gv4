import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { BudgetLines, budgetProblem, fromBudgetLine, linesTotal, QuickAmounts, type BudgetLine } from '@/components/budget-editor';
import { CustomerPicker } from '@/components/customer-picker';
import { KeyboardFormScroll } from '@/components/keyboard-form-scroll';
import { PanelAccessState } from '@/components/panel-access-state';
import { RepairAccessField } from '@/components/repair-access-field';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { parsePatternToDots, type AccessType } from '@/lib/repair-access';
import {
  ACCESS_TYPES,
  DEVICE_ICONS,
  DEVICE_TYPES,
  FREQUENT_ISSUES,
  KNOWN_BRANDS,
  PRIORITY,
  createRepair,
  fetchDeviceOptions,
  fetchTechnicians,
  isWholesale,
  newIdempotencyKey,
  rememberRepairs,
  validateRepairAccess,
  type DeviceOptions,
  type NewRepairInput,
  type RepairCustomer,
  type Technician,
} from '@/lib/repairs';

type Colors = ReturnType<typeof usePalette>;

/** Solo dígitos: el presupuesto se escribe como «150000» o «150.000». */
const parseAmount = (value: string) => Number(value.replace(/\D/g, '')) || 0;

/** Suma un problema frecuente al texto (sin repetirlo) respetando el máximo de 500 caracteres. */
const toggleIssue = (current: string, issue: string) => {
  const text = current.trim();
  if (!text) return issue;
  if (text.includes(issue)) {
    const escaped = issue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleaned = text
      .replace(new RegExp('\\.\\s*' + escaped + '\\.?', 'g'), '')
      .replace(new RegExp(escaped + '\\.?', 'g'), '')
      .replace(/^\s*\.\s*/, '')
      .replace(/\.\s*\./g, '.')
      .trim();
    return cleaned;
  }
  return `${text.replace(/[.,]$/, '')}. ${issue}`.slice(0, 500);
};

const formatAmount = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('es-PY') : '';
};

export default function NewRepairScreen() {
  const colors = usePalette();
  const navigation = useNavigation();
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
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [accessType, setAccessType] = useState<AccessType>('none');
  const [accessPassword, setAccessPassword] = useState('');
  const [priority, setPriority] = useState<NewRepairInput['priority']>('medium');
  const [labor, setLabor] = useState('');
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [devices, setDevices] = useState<DeviceOptions>({ brands: KNOWN_BRANDS, modelsByBrand: {} });
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [technicianId, setTechnicianId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdRepairId, setCreatedRepairId] = useState<string | null>(null);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [touched, setTouched] = useState(false);
  const [scanningImei, setScanningImei] = useState(false);
  const [drawingPattern, setDrawingPattern] = useState(false);

  useEffect(() => {
    fetchTechnicians().then(setTechnicians).catch(() => setTechnicians([]));
    fetchDeviceOptions().then(setDevices).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (createdRepairId) {
      router.replace(`/panel/repairs/${createdRepairId}` as never);
    }
  }, [createdRepairId]);

  const accessError = validateRepairAccess(accessType, accessPassword);
  const problems = {
    customer: !customer ? 'Elegí o creá el cliente.' : null,
    brand: brand.trim().length < 2 ? 'Escribí la marca (mínimo 2 letras).' : null,
    model: !model.trim() ? 'Escribí el modelo.' : null,
    problem: !problem.trim() ? 'Contá qué le pasa al equipo.' : null,
    access: accessError,
  };
  const budgetTotal = parseAmount(labor) + linesTotal(lines);
  const firstProblem = Object.values(problems).find(Boolean) ?? budgetProblem(lines);

  const clientReady = Boolean(customer);
  const deviceReady = brand.trim().length >= 2 && Boolean(model.trim());
  const problemReady = Boolean(problem.trim());
  const accessReady = !accessError;

  const steps = [
    { key: 'client', label: 'Cliente', done: clientReady, bad: touched && !clientReady },
    { key: 'device', label: 'Equipo', done: deviceReady, bad: touched && !deviceReady },
    { key: 'problem', label: 'Falla', done: problemReady, bad: touched && !problemReady },
    { key: 'access', label: 'Acceso', done: accessReady, bad: touched && !accessReady },
  ];
  const readyCount = steps.filter((step) => step.done).length;

  const isDirty = Boolean(
    customer ||
      brand.trim() ||
      model.trim() ||
      imei.trim() ||
      problem.trim() ||
      diagnosis.trim() ||
      accessType !== 'none' ||
      accessPassword.trim() ||
      labor.trim() ||
      lines.length > 0 ||
      technicianId,
  );

  usePreventRemove(isDirty && !saving && !createdRepairId, ({ data }) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Tenés datos cargados sin guardar. ¿Descartar esta reparación?')) {
        navigation.dispatch(data.action);
      }
      return;
    }
    Alert.alert('¿Salir sin guardar?', 'Los datos cargados para esta reparación se perderán.', [
      { text: 'Seguir cargando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

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
          access_password: accessType === 'none' ? undefined : accessPassword.trim() || undefined,
          priority,
          // El presupuesto es la mano de obra más los repuestos que se cobran.
          estimated_cost: budgetTotal,
          labor_cost: parseAmount(labor),
          parts: lines.map(fromBudgetLine),
          technician_id: technicianId,
        },
        idempotencyKey,
      );
      rememberRepairs([repair]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreatedRepairId(repair.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la reparación.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const show = (key: keyof typeof problems) => (touched ? problems[key] : null);
  const isPhoneOrTablet = deviceType === 'smartphone' || deviceType === 'tablet';
  const serialLabel = isPhoneOrTablet ? 'IMEI (opcional)' : 'N.º de serie (opcional)';
  const imeiDigits = imei.replace(/\D/g, '').length;

  const accessTypeLabel = ACCESS_TYPES.find((t) => t.key === accessType)?.label ?? 'Sin bloqueo';
  const patternDotCount = accessType === 'pattern' ? parsePatternToDots(accessPassword).length : 0;
  const accessBadge =
    accessType === 'none' || accessType === 'biometric'
      ? { label: accessTypeLabel, tone: 'ok' as const }
      : accessError
        ? { label: `${accessTypeLabel} · falta`, tone: touched ? ('bad' as const) : ('muted' as const) }
        : accessType === 'pattern'
          ? { label: patternDotCount >= 2 ? `Patrón · ${patternDotCount} pts` : 'Patrón ✓', tone: 'ok' as const }
          : { label: `${accessTypeLabel} ✓`, tone: 'ok' as const };

  const missing: string[] = [];
  if (!clientReady) missing.push('cliente');
  if (!deviceReady) missing.push('marca y modelo');
  if (!problemReady) missing.push('falla');
  if (!accessReady) missing.push('código de acceso');
  const missingSummary = missing.length > 0 ? `Falta: ${missing.join(', ')}` : 'Lista para registrar';

  if (!can('repairs.orders.create')) return <PanelAccessState />;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/panel/repairs' as never))}
          hitSlop={10}
          style={styles.iconBtn}
          accessibilityLabel="Volver"
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={[styles.topTitle, { color: colors.text }]}>Nueva reparación</Text>
          <Text numberOfLines={1} style={[styles.topSub, { color: colors.muted }]}>
            {[customer?.name, [brand.trim(), model.trim()].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Completá los datos básicos del ingreso'}
          </Text>
        </View>
        <View
          style={[
            styles.progressBadge,
            {
              backgroundColor:
                readyCount === 4
                  ? `${colors.successText}${colors.isDark ? '24' : '16'}`
                  : colors.accentSoft,
            },
          ]}
        >
          <Text style={[styles.progressBadgeText, { color: readyCount === 4 ? colors.successText : colors.accent }]}>
            {readyCount}/4
          </Text>
        </View>
      </View>

      {/* Franja compacta de avance */}
      <View style={[styles.progressStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stepsRow}>
          {steps.map((step) => {
            const color = step.bad ? colors.dangerText : step.done ? colors.successText : colors.muted;
            return (
              <View key={step.key} style={styles.stepPill}>
                <Ionicons
                  name={step.bad ? 'alert-circle' : step.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={13}
                  color={color}
                />
                <Text style={[styles.stepLabel, { color }]}>{step.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(readyCount / 4) * 100}%`,
                backgroundColor: readyCount === 4 ? colors.successText : palette.primary,
              },
            ]}
          />
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <KeyboardFormScroll
          scrollEnabled={!drawingPattern}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Cliente */}
          <Section
            number={1}
            title="Cliente"
            colors={colors}
            badge={clientReady ? { label: 'Listo', tone: 'ok' } : { label: 'Requerido', tone: touched ? 'bad' : 'muted' }}
            error={show('customer')}
          >
            <CustomerPicker value={customer} onChange={setCustomer} error={show('customer')} />
          </Section>

          {/* 2. Equipo */}
          <Section
            number={2}
            title="Equipo"
            colors={colors}
            badge={deviceReady ? { label: 'Listo', tone: 'ok' } : { label: 'Requerido', tone: touched && !deviceReady ? 'bad' : 'muted' }}
            error={show('brand') || show('model')}
          >
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
            <Input
              label="Marca"
              value={brand}
              onChangeText={setBrand}
              placeholder="Ej: Samsung, Apple, Motorola"
              colors={colors}
              invalid={Boolean(show('brand'))}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hChips} keyboardShouldPersistTaps="handled">
              {brandChips.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  selected={brand.trim().toLowerCase() === option.toLowerCase()}
                  onPress={() => setBrand(option)}
                  colors={colors}
                />
              ))}
            </ScrollView>
            <Input
              label="Modelo"
              value={model}
              onChangeText={setModel}
              placeholder="Ej: Galaxy A54, iPhone 13"
              colors={colors}
              invalid={Boolean(show('model'))}
            />
            {modelChips.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hChips} keyboardShouldPersistTaps="handled">
                {modelChips.map((option) => (
                  <Chip key={option} label={option} selected={false} onPress={() => setModel(option)} colors={colors} />
                ))}
              </ScrollView>
            )}

            {/* IMEI / Serie unificado con botón rápido de cámara */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text }]}>{serialLabel}</Text>
                {isPhoneOrTablet && imei.trim().length > 0 ? (
                  <Text
                    style={[
                      styles.small,
                      {
                        color: imeiDigits === 15 ? colors.successText : colors.muted,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {imeiDigits === 15 ? '✓ 15 dígitos' : `${imeiDigits}/15 dígitos`}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  value={imei}
                  onChangeText={(v) => setImei(isPhoneOrTablet ? v.replace(/[^\d\s-]/g, '') : v.toUpperCase())}
                  placeholder={isPhoneOrTablet ? '352091081234567' : 'N.º de serie'}
                  placeholderTextColor={colors.muted}
                  keyboardType={isPhoneOrTablet ? 'number-pad' : 'default'}
                  autoCapitalize="characters"
                  accessibilityLabel={serialLabel}
                  style={[styles.input, { color: colors.text }]}
                />
                {imei.length > 0 ? (
                  <Pressable onPress={() => setImei('')} hitSlop={8} style={{ padding: 4 }} accessibilityLabel="Borrar código">
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setScanningImei(true)}
                  hitSlop={6}
                  style={[styles.scanInlinePill, { backgroundColor: colors.accentSoft }]}
                  accessibilityLabel={isPhoneOrTablet ? 'Escanear IMEI con la cámara' : 'Escanear número de serie'}
                >
                  <Ionicons name="barcode-outline" size={16} color={colors.accent} />
                  <Text style={[styles.scanInlineText, { color: colors.accent }]}>Escanear</Text>
                </Pressable>
              </View>
              <Text style={[styles.small, { color: colors.muted }]}>
                {isPhoneOrTablet
                  ? 'Marcá *#06# en el equipo o escaneá la caja / bandeja SIM.'
                  : 'Podés escanear el código de barras o QR de la etiqueta del equipo.'}
              </Text>
            </View>
          </Section>

          {/* 3. Problema */}
          <Section
            number={3}
            title="Problema"
            colors={colors}
            badge={problemReady ? { label: 'Listo', tone: 'ok' } : { label: 'Requerido', tone: touched && !problemReady ? 'bad' : 'muted' }}
            error={show('problem')}
          >
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
              placeholder="No carga, pantalla rota, se mojó…"
              colors={colors}
              multiline
              maxLength={500}
              counter
              invalid={Boolean(show('problem'))}
            />
            {diagnosisOpen || diagnosis.trim().length > 0 ? (
              <Input
                label="Diagnóstico inicial (opcional)"
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder="Observaciones técnicas al recibir el equipo"
                colors={colors}
                multiline
                maxLength={1000}
                counter
              />
            ) : (
              <Pressable
                onPress={() => setDiagnosisOpen(true)}
                style={[styles.optionalToggle, { borderColor: colors.border, backgroundColor: colors.background }]}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                <Text style={[styles.optionalToggleText, { color: colors.accent }]}>Agregar diagnóstico inicial (opcional)</Text>
              </Pressable>
            )}
          </Section>

          {/* 4. Desbloqueo del equipo */}
          <Section
            number={4}
            title="Desbloqueo del equipo"
            colors={colors}
            badge={accessBadge}
            invalid={Boolean(show('access'))}
            error={accessType === 'pattern' ? null : show('access')}
          >
            <RepairAccessField
              accessType={accessType}
              accessPassword={accessPassword}
              onChangeType={(nextType, nextPassword) => {
                setAccessType(nextType);
                setAccessPassword(nextPassword);
                if (nextType !== 'pattern') setDrawingPattern(false);
              }}
              onChangePassword={setAccessPassword}
              error={show('access')}
              onDrawingChange={setDrawingPattern}
              disabled={saving}
            />
          </Section>

          {/* 5. Presupuesto */}
          <Section
            number={5}
            title="Presupuesto"
            colors={colors}
            badge={budgetTotal > 0 ? { label: formatGs(budgetTotal), tone: 'accent' } : { label: 'Opcional', tone: 'muted' }}
            error={touched ? budgetProblem(lines) : null}
          >
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
          <Section number={6} title="Prioridad y técnico" colors={colors} badge={{ label: 'Opcional', tone: 'muted' }}>
            <View style={styles.chips}>
              {(['low', 'medium', 'high'] as const).map((key) => (
                <Chip
                  key={key}
                  label={PRIORITY[key].label}
                  selected={priority === key}
                  onPress={() => setPriority(key)}
                  colors={colors}
                  tone={key === 'high' ? colors.dangerText : undefined}
                />
              ))}
            </View>
            {technicians.length > 0 && (
              <View style={styles.stack}>
                <Text style={[styles.label, { color: colors.text }]}>Técnico asignado</Text>
                <View style={styles.chips}>
                  <Chip label="Sin asignar" selected={!technicianId} onPress={() => setTechnicianId(null)} colors={colors} />
                  {technicians.map((tech) => (
                    <Chip
                      key={tech.id}
                      label={tech.name || 'Técnico'}
                      selected={technicianId === tech.id}
                      onPress={() => setTechnicianId(tech.id)}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
            )}
          </Section>

          {error && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: `${colors.dangerText}${colors.isDark ? '1C' : '12'}`,
                  borderColor: `${colors.dangerText}55`,
                },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
              <Text style={[styles.errorText, { color: colors.dangerText }]}>{error}</Text>
            </View>
          )}
        </KeyboardFormScroll>

        <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.footerMeta}>
            <Text numberOfLines={1} style={[styles.footerHint, { color: readyCount === 4 ? colors.successText : colors.muted }]}>
              {missingSummary}
            </Text>
            <Text style={[styles.footerAmount, { color: budgetTotal > 0 ? colors.text : colors.muted }]}>
              {budgetTotal > 0 ? formatGs(budgetTotal) : 'A presupuestar'}
            </Text>
          </View>
          <Pressable onPress={submit} disabled={saving} style={[styles.submit, { opacity: saving ? 0.7 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            <Text style={styles.submitText}>{saving ? 'Creando…' : 'Crear orden de reparación'}</Text>
          </Pressable>
        </View>

        <BarcodeScanner
          visible={scanningImei}
          onClose={() => setScanningImei(false)}
          title={isPhoneOrTablet ? 'Escanear IMEI del equipo' : 'Escanear número de serie'}
          hint="Apuntá la cámara a la caja, etiqueta trasera o pantalla (*#06#)"
          onScanned={(code: string) => {
            setScanningImei(false);
            const cleaned = isPhoneOrTablet ? code.replace(/\D/g, '').slice(0, 15) : code.trim();
            setImei(cleaned);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

function Section({
  number,
  title,
  colors,
  badge,
  invalid,
  error,
  children,
}: {
  number: number;
  title: string;
  colors: Colors;
  badge?: { label: string; tone: 'ok' | 'bad' | 'accent' | 'muted' };
  invalid?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  const hasError = Boolean(error || invalid);
  const badgeStyle = !badge
    ? null
    : badge.tone === 'ok'
      ? { bg: `${colors.successText}${colors.isDark ? '24' : '15'}`, fg: colors.successText }
      : badge.tone === 'bad'
        ? { bg: `${colors.dangerText}${colors.isDark ? '24' : '15'}`, fg: colors.dangerText }
        : badge.tone === 'accent'
          ? { bg: colors.accentSoft, fg: colors.accent }
          : { bg: colors.background, fg: colors.muted };

  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: hasError ? colors.dangerText : colors.border }]}>
      <View style={styles.sectionHead}>
        <View
          style={[
            styles.number,
            {
              backgroundColor: hasError
                ? colors.dangerText
                : badge?.tone === 'ok'
                  ? colors.successText
                  : palette.primary,
            },
          ]}
        >
          {badge?.tone === 'ok' && !hasError ? (
            <Ionicons name="checkmark" size={14} color="#fff" />
          ) : (
            <Text style={styles.numberText}>{number}</Text>
          )}
        </View>
        <Text style={[styles.sectionTitle, styles.flex, { color: colors.text }]}>{title}</Text>
        {badge && badgeStyle ? (
          <View style={[styles.sectionBadge, { backgroundColor: badgeStyle.bg }]}>
            <Text style={[styles.sectionBadgeText, { color: badgeStyle.fg }]}>{badge.label}</Text>
          </View>
        ) : null}
      </View>
      {children}
      {error ? <Text style={[styles.fieldError, { color: colors.dangerText }]}>{error}</Text> : null}
    </View>
  );
}

function Chip({
  label,
  icon,
  selected,
  onPress,
  colors,
  tone,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  colors: Colors;
  tone?: string;
}) {
  const color = tone ?? colors.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          borderColor: selected ? color : colors.border,
          backgroundColor: selected ? `${color}${colors.isDark ? '22' : '16'}` : colors.background,
        },
      ]}
    >
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
  invalid,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  colors: Colors;
  counter?: boolean;
  prefix?: string;
  invalid?: boolean;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {counter && maxLength ? (
          <Text style={[styles.small, { color: colors.muted }]}>{String(props.value ?? '').length}/{maxLength}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: invalid ? colors.dangerText : colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
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
  stack: { gap: 8 },
  small: { fontSize: 12 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 17, fontWeight: '800' },
  topSub: { fontSize: 11, marginTop: 1 },
  progressBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 42,
    alignItems: 'center',
  },
  progressBadgeText: { fontSize: 12, fontWeight: '900' },
  progressStrip: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepLabel: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  content: { padding: 14, gap: 14, paddingBottom: 24 },
  section: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  sectionBadgeText: { fontSize: 11, fontWeight: '800' },
  fieldError: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hChips: { gap: 8, paddingRight: 8 },
  budgetTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  budgetValue: { fontSize: 18, fontWeight: '900' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontSize: 15, fontWeight: '700', marginRight: 2 },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  multiline: { minHeight: 78, textAlignVertical: 'top' },
  scanInlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scanInlineText: { fontSize: 12, fontWeight: '800' },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 10,
  },
  optionalToggleText: { fontSize: 13, fontWeight: '700' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 14, fontWeight: '600' },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  footerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 2 },
  footerHint: { flex: 1, fontSize: 12, fontWeight: '700' },
  footerAmount: { fontSize: 14, fontWeight: '900' },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    borderRadius: 14,
    minHeight: 52,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
