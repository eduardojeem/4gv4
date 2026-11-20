import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Pide el correo de «restablecer contraseña» SIN PKCE.
 *
 * Con el cliente normal del navegador (`@supabase/ssr`, PKCE) el enlace trae
 * `?code=` y sólo se puede canjear con el `code_verifier` que quedó en una
 * cookie del navegador que pidió el correo. Ese verificador se perdía:
 *  - al abrir el correo en el celular, en otro navegador o en la app de Gmail;
 *  - y también en el MISMO navegador: auth-js borra todos los verificadores
 *    pendientes cada vez que cierra una sesión (`_removeSession`: cerrar sesión
 *    o un `Session not found` de una sesión vieja), así que entre pedir el
 *    correo y abrirlo el enlace quedaba inservible.
 *
 * Sin `code_challenge`, Supabase manda un enlace que vuelve con la sesión en el
 * hash (`#access_token=…&type=recovery`). No depende de nada guardado en el
 * navegador; `/auth/reset-password` lo recibe con `setSession`. Es el mismo
 * flujo que ya usa la app móvil (`/api/mobile/auth/password-reset`).
 *
 * El cliente no guarda sesión ni refresca tokens: sólo envía el pedido. El
 * captcha (Turnstile) se valida igual que antes.
 */

let recoveryClient: SupabaseClient | null = null

function getRecoveryClient(): SupabaseClient {
  if (recoveryClient) return recoveryClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Supabase no configurado: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }
  recoveryClient = createClient(url, anonKey, {
    auth: {
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // Clave propia: no comparte almacenamiento con el cliente de la sesión.
      storageKey: 'sb-password-recovery-request',
    },
  })
  return recoveryClient
}

export interface PasswordResetRequest {
  redirectTo: string
  captchaToken?: string | null
}

export function requestPasswordResetEmail(email: string, { redirectTo, captchaToken }: PasswordResetRequest) {
  return getRecoveryClient().auth.resetPasswordForEmail(email, {
    redirectTo,
    ...(captchaToken ? { captchaToken } : {}),
  })
}
