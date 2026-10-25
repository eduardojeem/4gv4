/**
 * En desarrollo, las imágenes de Supabase local quedan guardadas con la
 * dirección que tenía la PC al cargarlas (http://192.168.0.5:55321/…) o con la
 * del servidor (http://127.0.0.1:55321/…). Desde el celular ninguna sirve si
 * cambió la IP. Acá se pasan a la dirección de Supabase que usa la app.
 * Solo toca direcciones locales o de red privada: nunca las de producción.
 * Lógica pura, sin React Native, para poder probarla.
 */

const PRIVATE_HOST = /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i;
const LOCAL_STORAGE_URL = /^http:\/\/([^/:]+)(?::\d+)?(\/storage\/v1\/object\/[^\s"']*)$/i;

const isPrivateHost = (host: string) => PRIVATE_HOST.test(host);

/** El origen de destino solo vale si también es local: con un Supabase real no se toca nada. */
function localOrigin(target: string): string | null {
  try {
    const url = new URL(target);
    return url.protocol === 'http:' && isPrivateHost(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

export function rewriteLocalStorageUrl(value: string, targetSupabaseUrl: string): string {
  const origin = localOrigin(targetSupabaseUrl);
  if (!origin) return value;
  const match = LOCAL_STORAGE_URL.exec(value);
  if (!match || !isPrivateHost(match[1])) return value;
  return `${origin}${match[2]}`;
}

/** Recorre la respuesta (objetos y listas) y corrige cada dirección de imagen local. */
export function rewriteLocalStorageUrls<T>(value: T, targetSupabaseUrl: string): T {
  if (!localOrigin(targetSupabaseUrl)) return value;
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return node.startsWith('http://') ? rewriteLocalStorageUrl(node, targetSupabaseUrl) : node;
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, walk(item)]));
    return node;
  };
  return walk(value) as T;
}
