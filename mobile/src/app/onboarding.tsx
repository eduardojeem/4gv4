import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Notice, Section, WebsiteScreen, websiteStyles } from '@/components/website/website-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';
import { BUSINESS_VERTICALS } from '../../../src/lib/organization/business-profile';
import { getSupportedRegionalCountries, REGIONAL_CURRENCIES } from '../../../src/lib/regional/contract';
import {
  getRegionalSelection,
  ONBOARDING_MODULE_PREFERENCES,
  suggestOnboardingPreferences,
  validateBranchStep,
  validateBusinessStep,
  type SharedOnboardingState,
} from '../../../src/lib/onboarding/shared-setup';

type Bootstrap = { setupState: SharedOnboardingState | null; entitledModules: string[]; onboardingRevision: number };
const CATEGORIES: Record<string, string> = {
  general: 'Comercio general', clothing: 'Ropa y calzado', cosmetics: 'Cosmética', electronics: 'Electrónica y celulares',
  food: 'Alimentos', hardware: 'Ferretería', barbershop: 'Barbería', beauty_services: 'Servicios de belleza', other: 'Otro',
};
const US_ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'];
const STEPS = ['Plan', 'Negocio', 'Sucursal', 'Módulos', 'Listo'];

export default function OnboardingScreen() {
  const colors = usePalette();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [state, setState] = useState<SharedOnboardingState | null>(null);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    apiFetch<Bootstrap>('/api/onboarding/status')
      .then((result) => {
        if (!active) return;
        if (!result.setupState) throw new ApiError('Este comercio no tiene un onboarding inicial pendiente.', 409);
        setBootstrap(result);
        setRevision(result.onboardingRevision ?? 0);
        setState(result.setupState);
        setSelected(result.setupState.data.selectedModules ?? suggestOnboardingPreferences(result.setupState.data.businessCategory, result.entitledModules ?? []));
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const step = state?.completed ? 5 : Math.max(2, state?.currentStep ?? 2);
  const regional = state?.data.countryCode ? getRegionalSelection(state.data.countryCode) : null;
  const isUsTimezone = regional?.timezoneSelectionRequired === true;
  const updateBusiness = (patch: Partial<SharedOnboardingState['data']>) => {
    setState((current) => {
      if (!current) return current;
      const regionalChanged = (['countryCode', 'currency', 'timezone', 'locale'] as const).some((key) => key in patch && patch[key] !== current.data[key]);
      return { ...current, data: { ...current.data, ...patch, ...(regionalChanged && !('regionalConfirmed' in patch) ? { regionalConfirmed: false } : {}) } };
    });
    setFieldErrors([]);
    setError(null);
  };
  const updateBranch = (patch: Partial<SharedOnboardingState['data']['primaryBranch']>) => {
    setState((current) => current ? { ...current, data: { ...current.data, primaryBranch: { ...current.data.primaryBranch, ...patch } } } : current);
    setFieldErrors([]);
    setError(null);
  };

  const save = async () => {
    if (!state) return;
    let data: Record<string, unknown>;
    if (step === 2) {
      const validation = validateBusinessStep(state.data);
      if (!validation.valid) { setFieldErrors(validation.fields); return; }
      data = state.data as unknown as Record<string, unknown>;
    } else if (step === 3) {
      const validation = validateBranchStep(state.data.primaryBranch);
      if (!validation.valid) { setFieldErrors(validation.fields); return; }
      data = state.data.primaryBranch;
    } else {
      data = { selectedModules: selected };
    }
    setSaving(true);
    try {
      const result = await apiFetch<{ setupState?: SharedOnboardingState; revision?: number }>('/api/onboarding/status', {
        method: 'PATCH', body: JSON.stringify({ step, data, expectedRevision: revision }),
      });
      if (Number.isSafeInteger(result.revision)) setRevision(result.revision as number);
      if (result.setupState) setState(result.setupState);
      else setState((current) => current ? { ...current, currentStep: step === 2 ? 3 : step === 3 ? 4 : 5 } : current);
      if (step === 4) setState((current) => current ? { ...current, data: { ...current.data, selectedModules: selected } } : current);
      setFieldErrors([]);
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.body?.code === 'ONBOARDING_REVISION_CONFLICT') {
        try {
          const latest = await apiFetch<Bootstrap>('/api/onboarding/status');
          if (latest.setupState) {
            const local = state;
            const localDraft = step === 2 && local
              ? { businessName: local.data.businessName, countryCode: local.data.countryCode, businessCategory: local.data.businessCategory, currency: local.data.currency, timezone: local.data.timezone, locale: local.data.locale, regionalConfirmed: local.data.regionalConfirmed }
              : step === 3 && local ? { primaryBranch: local.data.primaryBranch } : { selectedModules: selected };
            setState({ ...latest.setupState, data: { ...latest.setupState.data, ...localDraft } });
            setRevision(latest.onboardingRevision ?? 0);
            setError('Tu configuración fue actualizada desde otro dispositivo. Recargamos los datos más recientes; revisá tu paso y volvé a guardar.');
            return;
          }
        } catch {
          // Preserve the current form if a refresh is temporarily unavailable.
        }
      }
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el paso.');
    } finally { setSaving(false); }
  };

  const finish = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ completedAt?: string; revision?: number }>('/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          sharedSetup: true,
          expectedRevision: revision,
          displayName: state.data.businessName,
          currency: state.data.currency,
          timezone: state.data.timezone,
          language: state.data.locale?.split('-')[0] ?? 'es',
          confirmCurrencyChange: true,
          phone: state.data.primaryBranch.phone,
          address: state.data.primaryBranch.address,
          city: state.data.primaryBranch.city,
          weekdays: state.data.primaryBranch.hours,
          saturday: '',
          businessVertical: state.data.businessCategory,
          operatingModel: 'retail',
          storefrontPublic: false,
          confirmPublication: false,
        }),
      });
      if (Number.isSafeInteger(result.revision)) setRevision(result.revision as number);
      setState((current) => current ? { ...current, completed: true, currentStep: 5, completedAt: result.completedAt ?? new Date().toISOString(), completedSteps: [...new Set([...current.completedSteps, 'ready' as const])] } : current);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.body?.code === 'ONBOARDING_REVISION_CONFLICT') {
        try {
          const latest = await apiFetch<Bootstrap>('/api/onboarding/status');
          if (latest.setupState) {
            setState(latest.setupState);
            setRevision(latest.onboardingRevision ?? 0);
            setError('Tu configuración fue actualizada desde otro dispositivo. Recargamos los datos más recientes; revisalos antes de finalizar.');
            return;
          }
        } catch {
          // Keep the current form visible if refreshing fails.
        }
      }
      setError(cause instanceof Error ? cause.message : 'No se pudo finalizar la configuración.');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.primary} /><Text style={{ color: colors.muted }}>Cargando tu configuración…</Text></View>;
  if (!state || !bootstrap) return <WebsiteScreen title="Configuración inicial"><Section title="No se pudo abrir"><Notice tone="danger" text={error ?? 'Volvé al panel e intentá nuevamente.'} /></Section></WebsiteScreen>;
  const planName = String(state.data.plan ?? 'Tu plan');
  const hasError = (key: string) => fieldErrors.includes(key) ? 'Completá este dato para continuar.' : undefined;

  return <WebsiteScreen title="Prepará tu negocio" subtitle={`Paso ${step} de 5 · Plan ${planName}`} footer={state.completed ? undefined : <View style={styles.footerRow}>
    {step > 2 ? <Pressable accessibilityRole="button" onPress={() => setState((current) => current ? { ...current, currentStep: (step - 1) as SharedOnboardingState['currentStep'] } : current)} style={[styles.outlineButton, styles.flexButton, { borderColor: colors.border }]}><Text style={[styles.outlineText, { color: colors.text }]}>Atrás</Text></Pressable> : <View style={styles.flexButton} />}
    {step < 5 ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[websiteStyles.primaryButton, styles.flexButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-forward" size={18} color="#fff" />}<Text style={websiteStyles.primaryText}>{saving ? 'Guardando…' : 'Guardar y continuar'}</Text></Pressable> : <Pressable accessibilityRole="button" disabled={saving} onPress={() => void finish()} style={[websiteStyles.primaryButton, styles.flexButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}<Text style={websiteStyles.primaryText}>{saving ? 'Guardando…' : 'Finalizar configuración'}</Text></Pressable>}
  </View>}>
    <View style={styles.progress} accessibilityLabel="Pasos de configuración">
      {STEPS.map((label, index) => <View key={label} style={[styles.progressStep, { borderColor: index + 1 < step ? palette.success : index + 1 === step ? palette.primary : colors.border, backgroundColor: index + 1 < step ? `${palette.success}16` : colors.card }]}><Text style={{ color: index + 1 === step ? palette.primary : colors.muted, fontSize: 11 }}>{index + 1 < step ? '✓' : index + 1} · {label}</Text></View>)}
    </View>
    {error ? <Notice tone="danger" text={error} /> : null}
    {step === 2 ? <Section title="Contanos sobre tu negocio" hint="Los datos regionales se guardan junto a la organización y se sincronizan con la web.">
      <Field label="Nombre del negocio" value={state.data.businessName} onChangeText={(businessName) => updateBusiness({ businessName })} error={hasError('businessName')} />
      <Text style={[styles.label, { color: colors.text }]}>País</Text><View style={styles.chips}>{getSupportedRegionalCountries().map(({ code, label }) => <Choice key={code} label={label} selected={state.data.countryCode === code} onPress={() => { const values = getRegionalSelection(code); updateBusiness({ countryCode: code, currency: values?.baseCurrency ?? null, timezone: values?.timezone ?? null, locale: values?.locale ?? null, regionalConfirmed: false }); }} />)}</View>{hasError('countryCode') ? <Text style={styles.error}>{hasError('countryCode')}</Text> : null}
      <Text style={[styles.label, { color: colors.text }]}>Rubro</Text><View style={styles.chips}>{BUSINESS_VERTICALS.map((category) => <Choice key={category} label={CATEGORIES[category] ?? category} selected={state.data.businessCategory === category} onPress={() => { updateBusiness({ businessCategory: category, selectedModules: null }); setSelected(suggestOnboardingPreferences(category, bootstrap.entitledModules)); }} />)}</View>{hasError('businessCategory') ? <Text style={styles.error}>{hasError('businessCategory')}</Text> : null}
      {state.data.countryCode ? <>
        <Text style={[styles.label, { color: colors.text }]}>Moneda</Text><View style={styles.chips}>{REGIONAL_CURRENCIES.map(({ code }) => <Choice key={code} label={code} selected={state.data.currency === code} onPress={() => updateBusiness({ currency: code })} />)}</View>
        <Field label="Idioma" value={state.data.locale ?? ''} onChangeText={(locale) => updateBusiness({ locale })} placeholder="es-PY" />
        {isUsTimezone ? <><Text style={[styles.label, { color: colors.text }]}>Zona horaria</Text><View style={styles.chips}>{US_ZONES.map((zone) => <Choice key={zone} label={zone.replace('America/', '')} selected={state.data.timezone === zone} onPress={() => updateBusiness({ timezone: zone })} />)}</View></> : <Field label="Zona horaria sugerida" value={state.data.timezone ?? ''} onChangeText={(timezone) => updateBusiness({ timezone })} />}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: state.data.regionalConfirmed }} onPress={() => updateBusiness({ regionalConfirmed: !state.data.regionalConfirmed })} style={styles.confirm}><Ionicons name={state.data.regionalConfirmed ? 'checkbox' : 'square-outline'} size={22} color={state.data.regionalConfirmed ? palette.primary : colors.muted} /><Text style={[styles.body, { color: colors.text }]}>Confirmo moneda, idioma y zona horaria.</Text></Pressable>{hasError('regionalConfirmed') ? <Text style={styles.error}>Confirmá los datos regionales para continuar.</Text> : null}
      </> : null}
    </Section> : null}
    {step === 3 ? <Section title="Sucursal principal" hint="Vamos a actualizar la sucursal ya creada para este negocio.">
      <Field label="Nombre de la sucursal" value={state.data.primaryBranch.name} onChangeText={(name) => updateBranch({ name })} error={hasError('branchName')} />
      <Field label="Ciudad o localidad" value={state.data.primaryBranch.city} onChangeText={(city) => updateBranch({ city })} error={hasError('city')} />
      <Field label="Dirección (opcional)" value={state.data.primaryBranch.address} onChangeText={(address) => updateBranch({ address })} />
      <Field label="Teléfono (opcional)" value={state.data.primaryBranch.phone} onChangeText={(phone) => updateBranch({ phone })} keyboardType="phone-pad" />
      <Field label="Horario de atención (opcional)" value={state.data.primaryBranch.hours} onChangeText={(hours) => updateBranch({ hours })} multiline />
    </Section> : null}
    {step === 4 ? <Section title="¿Qué querés usar?" hint="El plan define qué herramientas quedan disponibles; esta selección solo expresa tus preferencias.">
      {ONBOARDING_MODULE_PREFERENCES.map((item) => { const allowed = !item.entitlement || bootstrap.entitledModules.includes(item.entitlement); const checked = selected.includes(item.key); return <Pressable key={item.key} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !allowed }} disabled={!allowed} onPress={() => setSelected((current) => checked ? current.filter((key) => key !== item.key) : [...current, item.key])} style={[styles.moduleRow, { borderColor: colors.border, opacity: allowed ? 1 : 0.5 }]}><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={21} color={checked ? palette.primary : colors.muted} /><Text style={[styles.body, styles.flex, { color: colors.text }]}>{item.label}</Text>{!item.entitlement ? <Text style={[styles.caption, { color: colors.muted }]}>Preferencia</Text> : !allowed ? <Text style={[styles.caption, { color: colors.muted }]}>No incluido</Text> : null}</Pressable>; })}
    </Section> : null}
    {step === 5 ? <Section title={state.completed ? 'Tu negocio está listo' : 'Revisá tu negocio'} hint="Tu selección se guarda y queda compartida entre la web y el móvil.">
      <SummaryRow label="Plan" value={planName} /><SummaryRow label="Negocio" value={state.data.businessName} /><SummaryRow label="País y rubro" value={`${state.data.countryCode ?? '—'} · ${state.data.businessCategory ? CATEGORIES[state.data.businessCategory] : '—'}`} /><SummaryRow label="Moneda" value={state.data.currency ?? '—'} /><SummaryRow label="Sucursal" value={`${state.data.primaryBranch.name} · ${state.data.primaryBranch.city}`} /><SummaryRow label="Módulos elegidos" value={selected.map((key) => ONBOARDING_MODULE_PREFERENCES.find((item) => item.key === key)?.label ?? key).join(', ') || 'Ninguno por ahora'} />
      {state.completed ? <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => router.replace('/panel/products/form' as never)} style={websiteStyles.primaryButton}><Text style={websiteStyles.primaryText}>Agregar primer producto</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.replace('/panel/pos' as never)} style={[styles.outlineButton, { borderColor: colors.border }]}><Text style={[styles.outlineText, { color: colors.text }]}>Hacer primera venta</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.replace('/panel' as never)} style={[styles.outlineButton, { borderColor: colors.border }]}><Text style={[styles.outlineText, { color: colors.text }]}>Ir al panel</Text></Pressable></View> : null}
    </Section> : null}
  </WebsiteScreen>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[websiteStyles.chip, selected && styles.selected]}><Text style={[websiteStyles.chipText, selected && styles.selectedText]}>{label}</Text></Pressable>;
}
function SummaryRow({ label, value }: { label: string; value: string }) { const colors = usePalette(); return <View style={[styles.summaryRow, { borderColor: colors.border }]}><Text style={[styles.caption, { color: colors.muted }]}>{label}</Text><Text style={[styles.body, { color: colors.text }]}>{value || '—'}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  footerRow: { flexDirection: 'row', gap: 10 }, flexButton: { flex: 1 }, disabled: { opacity: 0.55 },
  progress: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 }, progressStep: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 7 },
  label: { fontSize: 13, fontWeight: '800', marginTop: 4 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  outlineButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, outlineText: { fontWeight: '800' },
  selected: { backgroundColor: `${palette.primary}16`, borderColor: palette.primary }, selectedText: { color: palette.primary },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9 }, body: { fontSize: 14, fontWeight: '600' },
  error: { color: palette.danger, fontSize: 12 }, moduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  caption: { fontSize: 12 }, summaryRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth }, actions: { gap: 10, marginTop: 12 },
});
