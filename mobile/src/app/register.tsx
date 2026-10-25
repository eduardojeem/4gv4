import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Notice, Section, WebsiteScreen, websiteStyles } from '@/components/website/website-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { checkStoreSlug, registerCompany, registerFieldErrors, requestCaptchaToken, type SlugCheck } from '@/lib/registration';
import { emptyRegisterForm, passwordChecks, registerIssues, registerPayload, storeSlugOf, type RegisterField, type RegisterForm } from '@/lib/registration-model';
import { useSession } from '@/lib/session';
import { VERTICAL_LABELS } from '@/lib/settings-model';
import { websiteErrorMessage } from '@/lib/website-admin';

type Plan = { tier: string; public_slug: string | null; name: string; price: number; price_note?: string | null; trial_days: number };

/**
 * Registro de un comercio nuevo desde la app, con la misma API que /register
 * en la web. Solo la verificación de seguridad (Cloudflare) se abre un momento
 * en el navegador; el resto es nativo.
 */
export default function RegisterScreen() {
  const colors = usePalette();
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ plan?: string }>();
  const [form, setForm] = useState<RegisterForm>(() => emptyRegisterForm(params.plan ?? ''));
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [slugState, setSlugState] = useState<{ slug: string; check: SlugCheck } | null>(null);
  const [serverErrors, setServerErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState<null | 'captcha' | 'saving' | 'signin'>(null);
  const [showPassword, setShowPassword] = useState(false);
  const slugRequest = useRef(0);

  const set = (next: Partial<RegisterForm>) => {
    setForm((current) => ({ ...current, ...next }));
    setServerErrors((current) => {
      const copy = { ...current };
      for (const key of Object.keys(next) as RegisterField[]) delete copy[key];
      if ('companyName' in next) delete copy.companySlug;
      return copy;
    });
  };

  // Los planes vigentes, con sus días de prueba reales.
  useEffect(() => {
    let alive = true;
    apiFetch<{ plans?: Plan[] }>('/api/mobile/saas', { auth: false })
      .then((catalog) => {
        if (!alive) return;
        const list = catalog.plans ?? [];
        setPlans(list);
        // El plan del enlace puede venir por su slug público o por el tier.
        setForm((current) => {
          const match = list.find((plan) => plan.public_slug === current.plan || plan.tier === current.plan);
          return { ...current, plan: match ? match.public_slug || match.tier : list.length === 1 ? list[0].public_slug || list[0].tier : '' };
        });
      })
      .catch((cause) => {
        if (alive) setPlansError(websiteErrorMessage(cause, 'No pudimos cargar los planes. Revisá tu conexión.'));
      });
    return () => {
      alive = false;
    };
  }, []);

  // Si la dirección de la tienda está libre, mientras se escribe (solo vale la última consulta).
  const slug = storeSlugOf(form);
  useEffect(() => {
    if (slug.length < 3) return;
    const id = ++slugRequest.current;
    const timer = setTimeout(() => {
      checkStoreSlug(slug)
        .then((check) => {
          if (id === slugRequest.current) setSlugState({ slug, check });
        })
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);
  const slugCheck = slugState?.slug === slug ? slugState.check : null;

  const localIssues = registerIssues(form);
  const issues = useMemo(() => ({ ...(submitted ? localIssues : {}), ...serverErrors }), [submitted, localIssues, serverErrors]);
  const slugTaken = slugCheck && !slugCheck.available ? slugCheck.message || 'Esa dirección ya está en uso.' : null;

  const submit = async () => {
    setSubmitted(true);
    const problems = Object.values(localIssues);
    if (problems.length || slugTaken) {
      Alert.alert('Revisá los datos', [...problems, ...(slugTaken ? [slugTaken] : [])].join('\n'));
      return;
    }
    setBusy('captcha');
    let token: string | null = null;
    try {
      token = await requestCaptchaToken();
    } catch {
      token = null;
    }
    if (!token) {
      setBusy(null);
      Alert.alert('Falta la verificación', 'Completá la verificación de seguridad para crear tu comercio.');
      return;
    }
    setBusy('saving');
    try {
      const result = await registerCompany(registerPayload(form, token));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.requiresEmailConfirmation) {
        router.replace({ pathname: '/sign-in', params: { registered: '1', confirmar: '1' } } as never);
        return;
      }
      // Sin confirmación de email pendiente, entra directo a su panel.
      setBusy('signin');
      const message = await signIn(form.email.trim(), form.password);
      router.replace((message ? { pathname: '/sign-in', params: { registered: '1' } } : '/panel') as never);
    } catch (cause) {
      const fields = registerFieldErrors(cause);
      if (Object.keys(fields).length) setServerErrors(fields as Partial<Record<RegisterField, string>>);
      const pending = cause instanceof ApiError && cause.body?.code === 'REGISTRATION_PENDING_CONFIRMATION';
      Alert.alert(
        pending ? 'Ya empezaste el registro' : 'No pudimos crear tu comercio',
        cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.message ? cause.message : websiteErrorMessage(cause, 'Revisá tu conexión e intentá nuevamente.'),
        pending ? [{ text: 'Ir a ingresar', onPress: () => router.replace({ pathname: '/sign-in', params: { registered: '1', confirmar: '1' } } as never) }] : undefined,
      );
    } finally {
      setBusy(null);
    }
  };

  const busyLabel = busy === 'captcha' ? 'Verificando…' : busy === 'saving' ? 'Creando tu comercio…' : busy === 'signin' ? 'Entrando…' : null;

  return (
    <WebsiteScreen
      title="Crear mi comercio"
      subtitle="Tu cuenta y tu tienda en minutos"
      footer={
        <Pressable onPress={() => void submit()} disabled={Boolean(busy)} accessibilityRole="button" style={[websiteStyles.primaryButton, busy ? styles.disabled : null]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="storefront-outline" size={18} color="#fff" />}
          <Text style={websiteStyles.primaryText}>{busyLabel ?? 'Crear mi comercio'}</Text>
        </Pressable>
      }>
      <Section title="Tu cuenta" icon="person-outline">
        <Field label="Nombre completo" value={form.fullName} onChangeText={(value) => set({ fullName: value })} placeholder="Ej. María González" autoCapitalize="words" maxLength={120} error={issues.fullName} />
        <Field label="Email" value={form.email} onChangeText={(value) => set({ email: value.trim() })} placeholder="nombre@tucomercio.com" keyboardType="email-address" autoCapitalize="none" maxLength={254} error={issues.email} />
        <Field label="Contraseña" value={form.password} onChangeText={(value) => set({ password: value })} placeholder="Mínimo 8 caracteres" autoCapitalize="none" maxLength={72} error={issues.password} secure={!showPassword} />
        <View style={styles.checks}>
          {passwordChecks(form.password).map((check) => (
            <View key={check.label} style={styles.check}>
              <Ionicons name={check.ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={check.ok ? palette.success : colors.muted} />
              <Text style={[styles.small, { color: check.ok ? colors.text : colors.muted }]}>{check.label}</Text>
            </View>
          ))}
        </View>
        <Field label="Repetí la contraseña" value={form.confirmPassword} onChangeText={(value) => set({ confirmPassword: value })} autoCapitalize="none" maxLength={72} error={issues.confirmPassword} secure={!showPassword} />
        <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, { color: palette.primary }]}>{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</Text>
        </Pressable>
      </Section>

      <Section title="Tu comercio" icon="storefront-outline">
        <Field label="Nombre del comercio" value={form.companyName} onChangeText={(value) => set({ companyName: value })} placeholder="Ej. Comercial San Miguel" maxLength={120} error={issues.companyName} />
        <Field label="Dirección de tu tienda" value={form.companySlug || slug} onChangeText={(value) => set({ companySlug: value })} placeholder="comercial-san-miguel" autoCapitalize="none" maxLength={48}
          error={issues.companySlug ?? slugTaken ?? undefined}
          help={slug.length >= 3 ? (slugCheck?.available ? `Libre: tu tienda va a estar en …/${slug}` : slugCheck ? undefined : 'Revisando si está libre…') : 'Sale del nombre; podés cambiarla.'} />
        {slugCheck && !slugCheck.available && slugCheck.suggestion ? (
          <Pressable onPress={() => set({ companySlug: slugCheck.suggestion ?? '' })} accessibilityRole="button">
            <Text style={[styles.link, { color: palette.primary }]}>Usar «{slugCheck.suggestion}»</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.label, { color: colors.text }]}>Rubro (opcional)</Text>
        <View style={styles.chips}>
          {Object.entries(VERTICAL_LABELS).map(([value, label]) => (
            <Chip key={value} label={label} selected={form.businessVertical === value} onPress={() => set({ businessVertical: form.businessVertical === value ? '' : value })} />
          ))}
        </View>
      </Section>

      <Section title="Plan" icon="pricetags-outline" hint="Podés cambiarlo más adelante.">
        {plansError ? <Notice tone="danger" text={plansError} /> : null}
        {!plans && !plansError ? <ActivityIndicator color={palette.primary} /> : null}
        {plans?.length === 0 ? <Notice tone="warning" text="No hay planes disponibles en este momento. Probá más tarde." /> : null}
        {plans?.map((plan) => {
          const value = plan.public_slug || plan.tier;
          const selected = form.plan === value;
          return (
            <Pressable key={value} onPress={() => set({ plan: value })} accessibilityRole="radio" accessibilityState={{ selected }}
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

      <Notice text="Al crear tu comercio se abre un momento la verificación de seguridad y volvés solo a la app." />
      <Pressable onPress={() => router.replace('/sign-in' as never)} accessibilityRole="button" style={styles.center}>
        <Text style={[styles.small, { color: colors.muted }]}>¿Ya tenés cuenta? <Text style={{ color: palette.primary, fontWeight: '800' }}>Ingresá</Text></Text>
      </Pressable>
    </WebsiteScreen>
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
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  small: { fontSize: 12 },
  link: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  planName: { fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.7 },
  center: { alignItems: 'center', paddingVertical: 8 },
});
