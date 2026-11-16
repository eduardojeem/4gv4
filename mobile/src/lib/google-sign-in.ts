import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getMobileRuntimeConfig } from './runtime-config';
import { describeGoogleError, parseOAuthReturnUrl } from './google-sign-in-model';

export type GoogleSignInResult =
  | { status: 'success'; tokens: { access_token: string; refresh_token: string } }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/** Ruta de vuelta registrada en Supabase: `mitiendapy://auth-callback` en la app publicada. */
export function googleRedirectUrl() {
  return Linking.createURL('auth-callback');
}

/**
 * Abre Google en el navegador del sistema y devuelve los tokens de Supabase.
 *
 * Se usa un cliente aparte, en memoria y con PKCE: guarda el verificador del
 * código solo mientras dura este intento y no toca la sesión de la app. Quien
 * llama guarda los tokens con `supabase.auth.setSession`, igual que el login
 * con contraseña.
 */
export async function startGoogleSignIn(): Promise<GoogleSignInResult> {
  const { supabaseUrl, supabaseKey } = getMobileRuntimeConfig();
  const oauth = createClient(supabaseUrl, supabaseKey, {
    auth: { flowType: 'pkce', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const redirectTo = googleRedirectUrl();

  try {
    const { data, error } = await oauth.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data?.url) return { status: 'error', message: describeGoogleError(error?.message) };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return { status: 'cancelled' };

    const parsed = parseOAuthReturnUrl(result.url);
    if (parsed.kind === 'cancelled') return { status: 'cancelled' };
    if (parsed.kind === 'error') return { status: 'error', message: parsed.message };

    const { data: exchanged, error: exchangeError } = await oauth.auth.exchangeCodeForSession(parsed.code);
    if (exchangeError || !exchanged.session) return { status: 'error', message: describeGoogleError(exchangeError?.message) };
    return {
      status: 'success',
      tokens: { access_token: exchanged.session.access_token, refresh_token: exchanged.session.refresh_token },
    };
  } catch (err) {
    return { status: 'error', message: describeGoogleError(err instanceof Error ? err.message : null) };
  }
}
