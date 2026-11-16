import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Notice, Section, WebsiteScreen, websiteStyles } from '@/components/website/website-ui';
import { ApiError } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';
import { registerCompany, registerFieldErrors, requestCaptchaToken } from '@/lib/registration';
import { emptyRegisterForm, passwordChecks, registerIssues, registerPayload, storeSlugOf, type RegisterField, type RegisterForm } from '@/lib/registration-model';
import { useSession } from '@/lib/session';
import { websiteErrorMessage } from '@/lib/website-admin';
import { CompanySignupFields, useSignupCatalog, useSlugAvailability } from '@/components/company-signup-fields';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

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
  const { plans, options: registrationOptions, error: plansError, retry: retryCatalog } = useSignupCatalog(setForm);
  const [serverErrors, setServerErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState<null | 'captcha' | 'saving' | 'signin'>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const set = (next: Partial<RegisterForm>) => {
    setForm((current) => ({ ...current, ...next }));
    setServerErrors((current) => {
      const copy = { ...current };
      for (const key of Object.keys(next) as RegisterField[]) delete copy[key];
      if ('companyName' in next) delete copy.companySlug;
      return copy;
    });
  };

  const slug = storeSlugOf(form);
  const slugCheck = useSlugAvailability(slug);

  const localIssues = registerIssues(form, registrationOptions?.companyPasswordMinLength ?? 8);
  const issues = useMemo(() => ({ ...(submitted ? localIssues : {}), ...serverErrors }), [submitted, localIssues, serverErrors]);
  const slugTaken = slugCheck && !slugCheck.available ? slugCheck.message || 'Esa dirección ya está en uso.' : null;

  const submit = async () => {
    if (busy || !registrationOptions || !plans?.length || plansError || !registrationOptions.companyRegistrationEnabled) return;
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
    } catch (cause) {
      setBusy(null);
      Alert.alert('No pudimos verificar el registro', cause instanceof Error ? cause.message : 'Revisá tu conexión y volvé a intentar.');
      return;
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
      router.replace((message ? { pathname: '/sign-in', params: { registered: '1' } } : '/onboarding') as never);
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
      saving={Boolean(busy)}
      title="Crear mi comercio"
      subtitle="Tu cuenta y tu tienda en minutos"
      footer={
        <Pressable onPress={() => void submit()} disabled={Boolean(busy) || !registrationOptions?.companyRegistrationEnabled || !plans?.length || Boolean(plansError)} accessibilityRole="button" style={[websiteStyles.primaryButton, busy ? styles.disabled : null]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="storefront-outline" size={18} color="#fff" />}
          <Text style={websiteStyles.primaryText}>{busyLabel ?? 'Crear mi comercio'}</Text>
        </Pressable>
      }>
      <View style={styles.googleBlock}>
        {/* Con Google no hay contraseña ni captcha: la cuenta queda creada y se completan los datos del comercio. */}
        <GoogleSignInButton
          label="Crear mi comercio con Google"
          disabled={Boolean(busy) || Boolean(registrationOptions && !registrationOptions.companyRegistrationEnabled)}
          onError={setGoogleError}
          afterSignIn={{ pathname: '/create-company', params: form.plan ? { plan: form.plan } : {} }}
        />
        {googleError ? <Text accessibilityRole="alert" style={[styles.small, { color: palette.danger }]}>{googleError}</Text> : null}
        <Text style={[styles.small, styles.centerText, { color: colors.muted }]}>o con tu correo y contraseña</Text>
      </View>
      <Section title="Tu cuenta" icon="person-outline">
        <Field label="Nombre completo" value={form.fullName} onChangeText={(value) => set({ fullName: value })} placeholder="Ej. María González" autoCapitalize="words" maxLength={120} error={issues.fullName} />
        <Field label="Email" value={form.email} onChangeText={(value) => set({ email: value.trim() })} placeholder="nombre@tucomercio.com" keyboardType="email-address" autoCapitalize="none" maxLength={254} error={issues.email} />
        <Field label="Contraseña" value={form.password} onChangeText={(value) => set({ password: value })} placeholder={`Mínimo ${registrationOptions?.companyPasswordMinLength ?? 8} caracteres`} autoCapitalize="none" maxLength={72} error={issues.password} secure={!showPassword} />
        <View style={styles.checks}>
          {passwordChecks(form.password, registrationOptions?.companyPasswordMinLength ?? 8).map((check) => (
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

      <CompanySignupFields
        form={form}
        onChange={set}
        issues={issues}
        slug={slug}
        slugCheck={slugCheck}
        slugTaken={slugTaken}
        plans={plans}
        plansError={plansError}
        onRetryPlans={retryCatalog}
        registrationClosed={Boolean(registrationOptions && !registrationOptions.companyRegistrationEnabled)}
      />

      <Notice text="Al crear tu comercio se abre un momento la verificación de seguridad y volvés solo a la app." />
      <Pressable onPress={() => router.replace('/sign-in' as never)} accessibilityRole="button" style={styles.center}>
        <Text style={[styles.small, { color: colors.muted }]}>¿Ya tenés cuenta? <Text style={{ color: palette.primary, fontWeight: '800' }}>Ingresá</Text></Text>
      </Pressable>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  googleBlock: { gap: 10 },
  centerText: { textAlign: 'center' },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  small: { fontSize: 12 },
  link: { fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.7 },
  center: { alignItems: 'center', paddingVertical: 8 },
});
