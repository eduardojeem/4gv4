/**
 * Lee la URL con la que Supabase devuelve a la app después de Google
 * (`mitiendapy://auth-callback?code=…`). Se parsea a mano: en React Native
 * `URL.searchParams` no está completo.
 */
export type OAuthReturn =
  | { kind: 'code'; code: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

function readParams(part: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of part.split('&')) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split('=');
    try {
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    } catch {
      // Un parámetro mal codificado no debe romper la lectura del resto.
    }
  }
  return params;
}

export function parseOAuthReturnUrl(url: string): OAuthReturn {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  // Los errores pueden venir en la query o en el hash según el paso que falló.
  const params = { ...readParams(hash), ...readParams(query) };

  if (params.code) return { kind: 'code', code: params.code };
  if (params.error === 'access_denied') return { kind: 'cancelled' };
  if (params.error || params.error_description) {
    return { kind: 'error', message: describeGoogleError(params.error_description ?? params.error) };
  }
  return { kind: 'error', message: describeGoogleError(null) };
}

export function describeGoogleError(detail: string | null | undefined): string {
  if (detail && /provider is not enabled|unsupported provider/i.test(detail)) {
    return 'El ingreso con Google todavía no está habilitado. Entrá con tu correo y contraseña.';
  }
  if (detail && /network|fetch|internet/i.test(detail)) {
    return 'No hay conexión. Revisá internet y probá de nuevo.';
  }
  return 'No se pudo completar el ingreso con Google. Probá de nuevo o entrá con tu correo.';
}
