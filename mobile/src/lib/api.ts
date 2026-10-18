import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://www.mitiendapy.com').replace(/\/$/, '');

/** Más que esto sin respuesta es un servidor caído o fuera de la red. */
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  /** El cuerpo de la respuesta: algunas APIs mandan datos útiles junto al error (p. ej. duplicados). */
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown> | null = null) {
    super(message);
  }
}

/**
 * Llama a las APIs del sistema web con la sesión de la app. La web usa cookies;
 * la app manda el token en `Authorization` y el backend lo valida igual.
 *
 * `auth: false` para el login, que todavía no tiene sesión.
 */
export async function apiFetch<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...options } = init;
  const token = auth ? (await supabase.auth.getSession()).data.session?.access_token : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
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

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // Sesión vencida o revocada (usuario dado de baja, contraseña cambiada):
    // se cierra acá para que la app vuelva al login en vez de quedar trabada.
    if (response.status === 401 && token) {
      const current = (await supabase.auth.getSession()).data.session;
      if (current?.access_token === token) await supabase.auth.signOut({ scope: 'local' });
    }
    const message = (body && (body.error || body.message)) || `Error ${response.status}`;
    throw new ApiError(String(message), response.status, body && typeof body === 'object' ? body : null);
  }
  return body as T;
}

export const apiBaseUrl = API_URL;
