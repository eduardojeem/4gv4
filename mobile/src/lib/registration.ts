import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { ApiError, apiFetch } from './api';
import { SITE_URL } from './marketplace';
import { parseCaptchaReturn, parseRegistrationReturn, registerCtaLabel, registrationUrl, type registerPayload } from './registration-model';

/**
 * Abre el registro de la web y vuelve a la app al terminar: la web redirige a
 * la dirección de la app, el navegador se cierra solo y se abre el ingreso con
 * el aviso de cuenta creada (y de confirmar el email, si hace falta).
 */
export async function openRegistration(path = '/register') {
  // En la app el registro es nativo; en la versión web el captcha no puede volver, sigue la web.
  if (Platform.OS !== 'web') {
    const plan = new URL(path, 'https://x.invalid').searchParams.get('plan');
    router.push({ pathname: '/register', params: plan ? { plan } : {} } as never);
    return;
  }
  await openWebRegistration(path);
}

/** El registro de la web con vuelta a la app (la versión web de la app usa este). */
export async function openWebRegistration(path = '/register') {
  const returnUrl = Linking.createURL('sign-in');
  try {
    const result = await WebBrowser.openAuthSessionAsync(registrationUrl(SITE_URL, path, returnUrl), returnUrl);
    if (result.type !== 'success') return;
    const { registered, confirmEmail } = parseRegistrationReturn(Linking.parse(result.url).queryParams ?? {});
    if (registered) router.replace({ pathname: '/sign-in', params: { registered: '1', ...(confirmEmail ? { confirmar: '1' } : {}) } } as never);
  } catch {
    Alert.alert('No se pudo abrir el registro', 'Revisá tu conexión y volvé a intentarlo.');
  }
}

// Los planes cambian poco: se piden una vez por apertura de la app.
let catalogPlans: Promise<{ trial_days?: number | null; price: number }[] | null> | null = null;

/** El texto del botón de registro con los días de prueba reales de los planes. */
export function useRegisterLabel() {
  const [label, setLabel] = useState(() => registerCtaLabel(null));
  useEffect(() => {
    let alive = true;
    catalogPlans ??= apiFetch<{ plans?: { trial_days?: number | null; price: number }[] }>('/api/mobile/saas', { auth: false })
      .then((catalog) => catalog.plans ?? null)
      .catch(() => {
        catalogPlans = null;
        return null;
      });
    void catalogPlans.then((plans) => {
      if (alive) setLabel(registerCtaLabel(plans));
    });
    return () => {
      alive = false;
    };
  }, []);
  return label;
}

// ─── Registro nativo ───────────────────────────────────────────────────────

/**
 * La verificación de seguridad: Cloudflare no tiene versión para la app, así que
 * se abre /auth/captcha-app, la persona la completa y el token vuelve a la app.
 * Devuelve null si la cerró sin completarla.
 */
export async function requestCaptchaToken(): Promise<string | null> {
  const returnUrl = Linking.createURL('captcha');
  const url = `${SITE_URL}/auth/captcha-app?app_return=${encodeURIComponent(returnUrl)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  if (result.type !== 'success') return null;
  return parseCaptchaReturn(Linking.parse(result.url).queryParams ?? {});
}

export type SlugCheck = { slug: string; available: boolean; message?: string; suggestion?: string | null };

/** Si la dirección de la tienda está libre (la misma consulta que la web mientras se escribe). */
export async function checkStoreSlug(slug: string): Promise<SlugCheck> {
  return apiFetch<SlugCheck>(`/api/auth/check-slug?slug=${encodeURIComponent(slug)}`, { auth: false });
}

export type RegisterResult = { requiresEmailConfirmation: boolean };

/** Crea el comercio con la misma API que la web. Los errores de campo vuelven en `fieldErrors`. */
export async function registerCompany(payload: ReturnType<typeof registerPayload>): Promise<RegisterResult> {
  const res = await apiFetch<{ success?: boolean; data?: { requiresEmailConfirmation?: boolean } }>('/api/auth/register-company', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(payload),
  });
  return { requiresEmailConfirmation: res.data?.requiresEmailConfirmation === true };
}

/** Los errores de campo que manda el servidor (dirección en uso, plan vencido…). */
export function registerFieldErrors(error: unknown): Record<string, string> {
  const list = error instanceof ApiError ? (error.body?.fieldErrors as { field?: string; message?: string }[] | undefined) : undefined;
  return Object.fromEntries((list ?? []).filter((item) => item.field && item.message).map((item) => [item.field as string, item.message as string]));
}
