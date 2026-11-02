/**
 * Verificación en dos pasos (2FA) en la app, con el MFA nativo de Supabase (TOTP).
 *
 * Supabase marca cada token con el nivel de la sesión (`aal`): `aal1` es sólo la
 * contraseña, `aal2` ya pasó el código de la app autenticadora. Con un factor
 * verificado y una sesión `aal1`, el servidor responde 401 a todo: la app no
 * muestra el panel hasta que se escribe el código.
 *
 * Es la misma regla que `src/lib/auth/mfa.ts` en la web; sin dependencias de
 * React Native para poder probarla.
 */

type FactorLike = { status?: string | null };
type SessionLike = { access_token?: string | null; user?: { factors?: FactorLike[] | null } | null } | null | undefined;

/** Código con el que el servidor dice que falta el segundo paso: no es una sesión vencida. */
export const MFA_REQUIRED_CODE = 'MFA_REQUIRED';

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
}

/** Nivel que dice el token. No valida la firma: eso lo hace Supabase en cada pedido. */
export function readTokenAal(token: string | null | undefined): 'aal1' | 'aal2' | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const { aal } = JSON.parse(decodeBase64Url(payload)) as { aal?: unknown };
    return aal === 'aal1' || aal === 'aal2' ? aal : null;
  } catch {
    return null;
  }
}

/** Tiene 2FA activa y esta sesión todavía no pasó el código. Sincrónico: se evalúa en cada render. */
export function isSessionMfaPending(session: SessionLike): boolean {
  if (!session) return false;
  const verified = Boolean(session.user?.factors?.some((factor) => factor.status === 'verified'));
  return verified && readTokenAal(session.access_token) !== 'aal2';
}

/** Deja sólo los dígitos: las apps muestran el código como «123 456». */
export function normalizeTotpCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

const MESSAGES: Record<string, string> = {
  mfa_verification_failed: 'El código no es correcto. Revisá la hora del teléfono y probá con el código nuevo.',
  mfa_challenge_expired: 'El código venció. Escribí el que muestra ahora la app.',
  mfa_factor_not_found: 'No encontramos tu app autenticadora. Volvé a iniciar sesión.',
  over_request_rate_limit: 'Demasiados intentos. Esperá unos minutos antes de volver a probar.',
  session_not_found: 'Tu sesión venció. Volvé a iniciar sesión.',
};

export function describeMfaError(error: unknown): string {
  if (error && typeof error === 'object') {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof code === 'string' && MESSAGES[code]) return MESSAGES[code];
    if (typeof message === 'string' && /invalid totp code|verification failed/i.test(message)) return MESSAGES.mfa_verification_failed;
    if (typeof message === 'string' && /network|fetch/i.test(message)) return 'No se pudo conectar. Revisá tu conexión a internet.';
  }
  return 'No se pudo verificar el código. Probá de nuevo.';
}

export const TOTP_ISSUER = 'MiTiendaPY';

/** La clave como la escriben las apps: grupos de 4 para cargarla a mano sin errores. */
export function formatTotpSecret(secret: string): string {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Enlace `otpauth://` para abrir la app autenticadora del mismo teléfono (el QR
 * no sirve: no se puede escanear la pantalla que lo muestra). Supabase ya lo
 * devuelve; si faltara, se arma con la clave.
 */
export function totpSetupUri(input: { uri?: string | null; secret: string; account: string }): string {
  if (input.uri && input.uri.startsWith('otpauth://')) return input.uri;
  const label = encodeURIComponent(`${TOTP_ISSUER}:${input.account}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(input.secret)}&issuer=${encodeURIComponent(TOTP_ISSUER)}`;
}
