import { getPrivateCacheContext, invalidatePrivateCacheContext, isPrivateCacheSnapshotCompatible, setPrivateCacheUser } from './private-cache-context';
import { supabase } from './supabase';
import { rewriteLocalStorageUrls } from './dev-storage-urls';
import { getMobileRuntimeConfig } from './runtime-config';

const RUNTIME = getMobileRuntimeConfig();
const API_URL = RUNTIME.apiUrl;
// En desarrollo, las imágenes de Supabase local guardadas con otra IP pasan a la de la app.
const fixDevUrls = <T,>(body: T): T => (RUNTIME.environment === 'development' ? rewriteLocalStorageUrls(body, RUNTIME.supabaseUrl) : body);

/** Más que esto sin respuesta es un servidor caído o fuera de la red. */
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  /** El cuerpo de la respuesta: algunas APIs mandan datos útiles junto al error (p. ej. duplicados). */
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown> | null = null) {
    super(message);
  }
}

/** Códigos con los que el servidor dice que se perdió el acceso al comercio, no solo un permiso. */
const ACCESS_LOST_CODES = new Set(['ORGANIZATION_REQUIRED', 'ACCOUNT_INACTIVE']);

/**
 * Un 403 casi siempre es «no tenés permiso para esto» y no cambia nada más: el
 * panel y lo que estás cargando siguen igual. Solo se descarta lo privado cuando
 * el servidor dice que ya no sos miembro del comercio o tu usuario está inactivo.
 */
export function isAccessLostResponse(status: number, body: unknown) {
  if (status !== 403 || !body || typeof body !== 'object') return false;
  const { code, error } = body as { code?: unknown; error?: unknown };
  // Servidores sin el código todavía: el texto que manda withTenantAuth sin membresía.
  return (typeof code === 'string' && ACCESS_LOST_CODES.has(code)) || error === 'Organization required';
}

/**
 * Llama a las APIs del sistema web con la sesión de la app. La web usa cookies;
 * la app manda el token en `Authorization` y el backend lo valida igual.
 *
 * `auth: false` para el login, que todavía no tiene sesión.
 */
export async function apiFetch<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...options } = init;
  const initialScope = getPrivateCacheContext();
  const session = auth ? (await supabase.auth.getSession()).data.session : null;
  // Mientras se leía la sesión pudo cambiar el usuario o el comercio. Terminar de
  // resolverlos (al abrir la app) no es un cambio: no se corta el pedido por eso.
  if (auth && initialScope.userId !== null && !isPrivateCacheSnapshotCompatible(initialScope)) {
    throw new ApiError('La sesión o el negocio cambió. Volvé a cargar los datos.', 409);
  }
  if (session?.user?.id && !getPrivateCacheContext().userId) setPrivateCacheUser(session.user.id);
  const requestScope = getPrivateCacheContext();
  if (auth && session?.user?.id && requestScope.userId !== session.user.id) throw new ApiError('La sesión cambió. Volvé a cargar los datos.', 409);
  const token = session?.access_token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const extraHeaders: Record<string,string> = {};
  new Headers(options.headers).forEach((value,key)=>{extraHeaders[key]=value});
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Con FormData (subida de archivos) el sistema arma el Content-Type con su separador.
        ...(options.body && !(typeof FormData !== 'undefined' && options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...extraHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(auth && requestScope.organizationId ? { 'x-organization-id': requestScope.organizationId } : {}),
        ...(auth && requestScope.branchId ? { 'x-branch-id': requestScope.branchId } : {}),

      },
    });
  } catch {
    throw new ApiError(
      controller.signal.aborted
        ? 'El servidor tardó demasiado en responder. Revisá tu conexión y probá de nuevo.'
        : 'No se pudo conectar con el servidor. Revisá tu conexión a internet.',
      0
    );
  } finally {
    clearTimeout(timer);
  }

  const body = fixDevUrls(await response.json().catch(() => null));
  if (!response.ok) {
    // 401: sesión vencida o revocada (usuario dado de baja, contraseña cambiada), se
    // cierra para volver al login. 403 de membresía perdida: se descarta lo privado.
    // Un 403 de permisos no toca nada. Una respuesta de otra sesión no revoca la nueva.
    const revoked = response.status === 401 || isAccessLostResponse(response.status, body);
    if (auth && revoked && isPrivateCacheSnapshotCompatible(requestScope)) {
      const current = (await supabase.auth.getSession()).data.session;
      if (current?.access_token === token && isPrivateCacheSnapshotCompatible(requestScope)) {
        invalidatePrivateCacheContext(requestScope);
        if (response.status === 401 && token) await supabase.auth.signOut({ scope: 'local' });
      }
    }
    const message = (body && (body.error || body.message)) || `Error ${response.status}`;
    throw new ApiError(String(message), response.status, body && typeof body === 'object' ? body : null);
  }
  if (auth && !isPrivateCacheSnapshotCompatible(requestScope)) throw new ApiError('La sesión, los permisos o el negocio cambió. Volvé a cargar los datos.', 409);
  return body as T;
}

export const apiBaseUrl = API_URL;
