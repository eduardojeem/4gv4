/**
 * Borrador del formulario de producto.
 *
 * El modal guarda todo en estado de React, asi que cualquier cosa que
 * desmonte el arbol —una recarga de la pestaña, un remonte del layout— borra lo
 * que se estaba cargando. Es lo que hace que alguien se vaya a otra ventana a
 * copiar un dato y al volver tenga que escribir todo de nuevo.
 *
 * Se guarda en `sessionStorage` y no en `localStorage` a proposito: el borrador
 * pertenece a esta pestaña y a esta sesion de trabajo. En localStorage
 * sobreviviria a cerrar el navegador y reaparecerian borradores de la semana
 * pasada como si fueran de recien.
 */

const PREFIJO = 'product-draft:'

/** Pasado este tiempo el borrador no se ofrece: es de otro momento. */
const VIGENCIA_MS = 60 * 60 * 1000
const pendientes = new Map<string, { valores: Record<string, unknown>; timer: ReturnType<typeof setTimeout> }>()

export function scheduleProductDraft(productId: string | null, valores: Record<string, unknown>, scope?: string | null) {
  if (typeof window === 'undefined') return
  const key = clave(productId, scope)
  if (!key) return
  const previous = pendientes.get(key)
  if (previous) clearTimeout(previous.timer)
  pendientes.set(key, { valores: { ...valores }, timer: setTimeout(() => flushProductDraft(productId, scope), 300) })
}

export function flushProductDraft(productId: string | null, scope?: string | null) {
  const key = clave(productId, scope)
  if (!key) return
  const pending = pendientes.get(key)
  if (!pending) return
  clearTimeout(pending.timer)
  pendientes.delete(key)
  saveProductDraft(productId, pending.valores, scope)
}

type BorradorGuardado = {
  guardadoEn: number
  valores: Record<string, unknown>
}

function clave(productId: string | null, scope?: string | null) {
  if (scope === null) return null
  return `${PREFIJO}${scope === undefined ? '' : encodeURIComponent(scope) + ':'}${productId ?? 'nuevo'}`
}

/**
 * Toda la lectura y escritura va envuelta: en una ventana privada o con el
 * almacenamiento bloqueado, `sessionStorage` lanza al tocarlo. Perder el
 * borrador es malo; que reviente el formulario por eso seria peor.
 */
export function saveProductDraft(productId: string | null, valores: Record<string, unknown>, scope?: string | null) {
  if (typeof window === 'undefined') return
  const key = clave(productId, scope)
  if (!key) return
  try {
    const payload: BorradorGuardado = { guardadoEn: Date.now(), valores }
    window.sessionStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Sin espacio o sin permiso: se sigue sin borrador.
  }
}

export function readProductDraft(productId: string | null, scope?: string | null): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null
  const key = clave(productId, scope)
  if (!key) return null
  try {
    const crudo = window.sessionStorage.getItem(key)
    if (!crudo) return null

    const payload = JSON.parse(crudo) as BorradorGuardado
    if (!payload?.valores || typeof payload.guardadoEn !== 'number') return null

    if (Date.now() - payload.guardadoEn > VIGENCIA_MS) {
      clearProductDraft(productId, scope)
      return null
    }

    return payload.valores
  } catch {
    return null
  }
}

export function clearProductDraft(productId: string | null, scope?: string | null) {
  const key = clave(productId, scope)
  if (!key) return
  const pending = pendientes.get(key)
  if (pending) clearTimeout(pending.timer)
  pendientes.delete(key)
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Nada que hacer.
  }
}
