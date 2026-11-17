import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';

import { CompanySignupFields, useSignupCatalog, useSlugAvailability } from '@/components/company-signup-fields';
import { Notice, WebsiteScreen, websiteStyles } from '@/components/website/website-ui';
import { ApiError } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';
import { createOwnCompany, registerFieldErrors } from '@/lib/registration';
import { refreshMarketplaceAccount } from '@/lib/marketplace-account';
import { companyIssues, emptyCompanyForm, ownCompanyPayload, storeSlugOf, type CompanyForm } from '@/lib/registration-model';
import { useSession } from '@/lib/session';
import { websiteErrorMessage } from '@/lib/website-admin';

/**
 * Abrir un comercio con la cuenta que ya está iniciada: después de entrar con
 * Google, o un cliente que ahora quiere vender. Solo pide los datos del
 * comercio; la cuenta sale de la sesión.
 */
export default function CreateCompanyScreen() {
  const colors = usePalette();
  const { session } = useSession();
  const params = useLocalSearchParams<{ plan?: string }>();
  const [form, setForm] = useState<CompanyForm>(() => emptyCompanyForm(params.plan ?? ''));
  const { plans, options, error: plansError, retry } = useSignupCatalog(setForm);
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof CompanyForm, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const slug = storeSlugOf(form);
  const slugCheck = useSlugAvailability(slug);
  const slugTaken = slugCheck && !slugCheck.available ? slugCheck.message || 'Esa dirección ya está en uso.' : null;
  const localIssues = companyIssues(form);
  const issues = useMemo(() => ({ ...(submitted ? localIssues : {}), ...serverErrors }), [submitted, localIssues, serverErrors]);
  const closed = Boolean(options && !options.companyRegistrationEnabled);

  const set = (next: Partial<CompanyForm>) => {
    setForm((current) => ({ ...current, ...next }));
    setServerErrors((current) => {
      const copy = { ...current };
      for (const key of Object.keys(next) as (keyof CompanyForm)[]) delete copy[key];
      if ('companyName' in next) delete copy.companySlug;
      return copy;
    });
  };

  const submit = async () => {
    if (pending.current || closed || !plans?.length) return;
    setSubmitted(true);
    const problems = Object.values(localIssues);
    if (problems.length || slugTaken) {
      Alert.alert('Revisá los datos', [...problems, ...(slugTaken ? [slugTaken] : [])].join('\n'));
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await createOwnCompany(ownCompanyPayload(form));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Los primeros pasos del comercio, igual que después del registro.
      router.replace('/onboarding' as never);
    } catch (cause) {
      const fields = registerFieldErrors(cause);
      if (Object.keys(fields).length) setServerErrors(fields as Partial<Record<keyof CompanyForm, string>>);
      const alreadyHas = cause instanceof ApiError && cause.body?.code === 'ALREADY_HAS_COMPANY';
      // Ya tenía comercio (p. ej. lo creó en la web): la cuenta del marketplace estaba desactualizada.
      if (alreadyHas) refreshMarketplaceAccount();
      Alert.alert(
        alreadyHas ? 'Ya tenés un comercio' : 'No pudimos crear tu comercio',
        cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.message ? cause.message : websiteErrorMessage(cause, 'Revisá tu conexión e intentá nuevamente.'),
        alreadyHas ? [{ text: 'Ir al panel', onPress: () => router.replace('/panel' as never) }] : undefined,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const email = session?.user.email;
  return (
    <WebsiteScreen
      saving={busy}
      title="Crear mi comercio"
      subtitle="Tu cuenta ya está lista. Faltan los datos de tu negocio."
      footer={
        <Pressable onPress={() => void submit()} disabled={busy || closed || !plans?.length || Boolean(plansError)} accessibilityRole="button" style={[websiteStyles.primaryButton, busy ? styles.disabled : null]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="storefront-outline" size={18} color="#fff" />}
          <Text style={websiteStyles.primaryText}>{busy ? 'Creando tu comercio…' : 'Crear mi comercio'}</Text>
        </Pressable>
      }>
      {email ? <Notice text={`Vas a ser el dueño del comercio con la cuenta ${email}.`} /> : null}
      <CompanySignupFields
        form={form}
        onChange={set}
        issues={issues}
        slug={slug}
        slugCheck={slugCheck}
        slugTaken={slugTaken}
        plans={plans}
        plansError={plansError}
        onRetryPlans={retry}
        registrationClosed={closed}
      />
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))} accessibilityRole="button" style={styles.center}>
        <Text style={[styles.small, { color: colors.muted }]}>Ahora no, <Text style={{ color: palette.primary, fontWeight: '800' }}>seguir comprando</Text></Text>
      </Pressable>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.7 },
  small: { fontSize: 12 },
  center: { alignItems: 'center', paddingVertical: 8 },
});
