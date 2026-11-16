/**
 * A dónde ir apenas se inicia sesión con Google. No se puede navegar desde la
 * pantalla que abrió Google: el registro solo existe sin sesión, así que al
 * guardarse la sesión desaparece y el layout manda al inicio, pisando
 * cualquier navegación que esa pantalla haya pedido. El layout lo lee cuando
 * ve la sesión nueva y navega recién ahí.
 */
export type PostAuthRoute = { pathname: string; params?: Record<string, string> };

let pending: PostAuthRoute | null = null;

export function setPostAuthRoute(route: PostAuthRoute | null) {
  pending = route;
}

/** Devuelve la ruta pendiente una sola vez. */
export function takePostAuthRoute(): PostAuthRoute | null {
  const route = pending;
  pending = null;
  return route;
}

/** El 403 del panel cuando la cuenta no tiene comercio (con o sin el código, según la versión del servidor). */
export function isNoBusinessError(status: number | undefined, body: Record<string, unknown> | null | undefined, message: string) {
  if (status !== 403) return false;
  return body?.code === 'NO_ACTIVE_ORGANIZATION' || /ning[uú]n comercio activo/i.test(message);
}
