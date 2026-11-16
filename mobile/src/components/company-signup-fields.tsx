import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Notice, Section, websiteStyles } from '@/components/website/website-ui';
import { apiFetch } from '@/lib/api';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { checkStoreSlug, type SlugCheck } from '@/lib/registration';
import type { CompanyForm } from '@/lib/registration-model';
import { VERTICAL_LABELS } from '@/lib/settings-model';
import { websiteErrorMessage } from '@/lib/website-admin';

export type SignupPlan = { tier: string; public_slug: string | null; name: string; price: number; price_note?: string | null; trial_days: number };
export type RegistrationOptions = { companyRegistrationEnabled: boolean; companyPasswordMinLength: number };

/**
 * Los planes vigentes (con sus días de prueba reales) y si el registro de
 * empresas está abierto. Preselecciona en el formulario el plan del enlace si
 * existe, o el único que haya. `setForm` es el setter de useState (estable).
 */
export function useSignupCatalog<T extends { plan: string }>(setForm: Dispatch<SetStateAction<T>>) {
  const [attempt, setAttempt] = useState(0);
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [plans, setPlans] = useState<SignupPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiFetch<{ plans?: SignupPlan[] }>('/api/mobile/saas', { auth: false }),
      apiFetch<RegistrationOptions>('/api/mobile/registration-options', { auth: false }),
    ])
      .then(([catalog, registration]) => {
        if (!alive) return;
        setOptions(registration);
        setError(null);
        const list = catalog.plans ?? [];
        setPlans(list);
        // El plan del enlace puede venir por su slug público o por el tier.
        setForm((current) => {
          const match = list.find((plan) => plan.public_slug === current.plan || plan.tier === current.plan);
          return { ...current, plan: match ? match.public_slug || match.tier : list.length === 1 ? list[0].public_slug || list[0].tier : '' };
        });
      })
      .catch((cause) => {
        if (alive) setError(websiteErrorMessage(cause, 'No pudimos cargar los planes. Revisá tu conexión.'));
      });
    return () => {
      alive = false;
    };
  }, [attempt, setForm]);

  return {
    plans,
    options,
    error,
    retry: () => {
      setError(null);
      setAttempt((value) => value + 1);
    },
  };
}

/** Si la dirección de la tienda está libre, mientras se escribe (solo vale la última consulta). */
export function useSlugAvailability(slug: string): SlugCheck | null {
  const [state, setState] = useState<{ slug: string; check: SlugCheck } | null>(null);
  const request = useRef(0);
  useEffect(() => {
    if (slug.length < 3) return;
    const id = ++request.current;
    const timer = setTimeout(() => {
      checkStoreSlug(slug)
        .then((check) => {
          if (id === request.current) setState({ slug, check });
        })
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);
  return state?.slug === slug ? state.check : null;
}

/** «Tu comercio» y «Plan»: lo mismo en el registro nuevo y en el alta con sesión iniciada. */
export function CompanySignupFields({
  form,
  onChange,
  issues,
  slug,
  slugCheck,
  slugTaken,
  plans,
  plansError,
  onRetryPlans,
  registrationClosed,
}: {
  form: CompanyForm;
  onChange: (next: Partial<CompanyForm>) => void;
  issues: Partial<Record<keyof CompanyForm, string>>;
  slug: string;
  slugCheck: SlugCheck | null;
  slugTaken: string | null;
  plans: SignupPlan[] | null;
  plansError: string | null;
  onRetryPlans: () => void;
  registrationClosed: boolean;
}) {
  const colors = usePalette();
  return (
    <>
      <Section title="Tu comercio" icon="storefront-outline">
        <Field label="Nombre del comercio" value={form.companyName} onChangeText={(value) => onChange({ companyName: value })} placeholder="Ej. Comercial San Miguel" maxLength={120} error={issues.companyName} />
        <Field label="Dirección de tu tienda" value={form.companySlug || slug} onChangeText={(value) => onChange({ companySlug: value })} placeholder="comercial-san-miguel" autoCapitalize="none" maxLength={48}
          error={issues.companySlug ?? slugTaken ?? undefined}
          help={slug.length >= 3 ? (slugCheck?.available ? `Libre: tu tienda va a estar en …/${slug}` : slugCheck ? undefined : 'Revisando si está libre…') : 'Sale del nombre; podés cambiarla.'} />
        {slugCheck && !slugCheck.available && slugCheck.suggestion ? (
          <Pressable onPress={() => onChange({ companySlug: slugCheck.suggestion ?? '' })} accessibilityRole="button">
            <Text style={[styles.link, { color: palette.primary }]}>Usar «{slugCheck.suggestion}»</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.label, { color: colors.text }]}>Rubro (opcional)</Text>
        <View style={styles.chips}>
          {Object.entries(VERTICAL_LABELS).map(([value, label]) => (
            <Chip key={value} label={label} selected={form.businessVertical === value} onPress={() => onChange({ businessVertical: form.businessVertical === value ? '' : value })} />
          ))}
        </View>
      </Section>

      <Section title="Plan" icon="pricetags-outline" hint="Podés cambiarlo más adelante.">
        {plansError ? <View style={{ gap: 10 }}><Notice tone="danger" text={plansError} /><Pressable accessibilityRole="button" onPress={onRetryPlans}><Text style={{ color: palette.primary, fontWeight: '700' }}>Reintentar planes y requisitos</Text></Pressable></View> : null}
        {registrationClosed ? <Notice tone="warning" text="El registro de empresas está cerrado por el momento. Podés crear una cuenta personal o volver más tarde." /> : null}
        {!plans && !plansError ? <ActivityIndicator color={palette.primary} /> : null}
        {plans?.length === 0 ? <Notice tone="warning" text="No hay planes disponibles en este momento. Probá más tarde." /> : null}
        {plans?.map((plan) => {
          const value = plan.public_slug || plan.tier;
          const selected = form.plan === value;
          return (
            <Pressable key={value} onPress={() => onChange({ plan: value })} accessibilityRole="radio" accessibilityState={{ selected }}
              style={[styles.plan, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}10` : 'transparent' }]}>
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? palette.primary : colors.muted} />
              <View style={styles.flex}>
                <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                <Text style={[styles.small, { color: colors.muted }]}>
                  {Number(plan.price) > 0 ? `${formatGs(Number(plan.price))}${plan.price_note ? ` ${plan.price_note}` : ''}` : 'Gratis'}
                  {plan.trial_days > 0 ? ` · ${plan.trial_days} días de prueba` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {issues.plan ? <Text style={[styles.small, { color: palette.danger }]}>{issues.plan}</Text> : null}
      </Section>
    </>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={[websiteStyles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}12` : 'transparent' }]}>
      <Text style={[websiteStyles.chipText, { color: selected ? palette.primary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  small: { fontSize: 12 },
  link: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  planName: { fontSize: 15, fontWeight: '800' },
});
