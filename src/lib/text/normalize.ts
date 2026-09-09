/** Marcas diacriticas combinantes: U+0300 a U+036F. */
const COMBINING_MARKS = /[̀-ͯ]/g

/**
 * Normalizacion de texto para busquedas en castellano.
 *
 * Habia dos copias de esta misma funcion —en `customers/search` y en
 * `checkout/delivery-zone`— y el buscador del panel de administracion no usaba
 * ninguna: comparaba con `includes()` crudo. En una interfaz donde las secciones
 * se llaman «Configuración» y «Análisis», eso significa que escribir
 * «configuracion» no encuentra nada.
 */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .trim()
}

/**
 * Atajo de teclado tal como lo escribe el sistema donde corre.
 *
 * El encabezado mostraba «Ctrl+K» fijo, mientras el manejador acepta tambien
 * `metaKey`: en una Mac el cartel decia una tecla y funcionaba la otra.
 */
export function primaryModifierLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl'
  const platform = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl'
}
