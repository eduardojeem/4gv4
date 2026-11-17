/**
 * Largo de página = largo del comprobante, para impresoras térmicas de rollo.
 *
 * Los comprobantes pedían `@page { size: 80mm auto }`, pero Chrome no acepta
 * «auto» como largo: usaba el papel del driver (a menudo 80 × 297 mm) y la
 * impresora avanzaba papel en blanco antes de cortar. Justo antes de imprimir
 * se mide el contenido y se fija el tamaño exacto, así la página termina donde
 * termina el texto y el corte («al final del documento») cae ahí.
 */

/** 96 px por pulgada en pantalla; 25,4 mm por pulgada. */
const MM_PER_PX = 25.4 / 96
/** Margen de seguridad: si el cálculo queda corto, el final saldría en otra página. */
const SAFETY_MM = 8
/** Nunca menos que esto: un ticket casi vacío igual necesita lugar para cortar. */
const MIN_HEIGHT_MM = 60
/** Tope razonable: más largo que esto conviene dejar que el driver pagine. */
const MAX_HEIGHT_MM = 3000

export const THERMAL_PAGE_STYLE_ID = 'thermal-page-fit'

export function thermalPageHeightMm(contentHeightPx: number): number {
  const mm = Math.ceil(Math.max(0, contentHeightPx) * MM_PER_PX) + SAFETY_MM
  return Math.min(MAX_HEIGHT_MM, Math.max(MIN_HEIGHT_MM, mm))
}

/** Ancho del rollo según el ancho útil del contenido (para los comprobantes que solo lo conocen así). */
export function rollWidthForContent(contentWidthMm: number): 58 | 80 {
  return contentWidthMm <= 52 ? 58 : 80
}

export function thermalPageCss(widthMm: number, heightMm: number): string {
  return `@page{size:${widthMm}mm ${heightMm}mm}`
}

/**
 * Fija el tamaño de página exacto en un documento ya cargado. Se agrega al
 * final del <head>, así gana sobre el `@page` del comprobante (solo cambia el
 * tamaño; los márgenes de cada plantilla se respetan).
 */
export function fitThermalPage(doc: Document | null | undefined, widthMm: number): number | null {
  try {
    if (!doc?.documentElement) return null
    const height = Math.max(doc.documentElement.scrollHeight || 0, doc.body?.scrollHeight || 0)
    const heightMm = thermalPageHeightMm(height)
    let style = doc.getElementById(THERMAL_PAGE_STYLE_ID) as HTMLStyleElement | null
    if (!style) {
      style = doc.createElement('style')
      style.id = THERMAL_PAGE_STYLE_ID
      ;(doc.head || doc.documentElement).appendChild(style)
    }
    style.textContent = thermalPageCss(widthMm, heightMm)
    return heightMm
  } catch {
    // Si no se puede medir, se imprime como antes.
    return null
  }
}

/**
 * La misma medición como texto de script, para los comprobantes que se
 * imprimen solos al abrir su ventana (llaman a `window.print()` en `load`).
 */
export function fitThermalPageScript(widthMm: number): string {
  return `(function(){try{var d=document,e=d.documentElement,h=Math.max(e.scrollHeight||0,d.body?d.body.scrollHeight:0);`
    + `var mm=Math.min(${MAX_HEIGHT_MM},Math.max(${MIN_HEIGHT_MM},Math.ceil(h*${MM_PER_PX})+${SAFETY_MM}));`
    + `var s=d.getElementById('${THERMAL_PAGE_STYLE_ID}');if(!s){s=d.createElement('style');s.id='${THERMAL_PAGE_STYLE_ID}';(d.head||e).appendChild(s);}`
    + `s.textContent='@page{size:${widthMm}mm '+mm+'mm}';}catch(x){}})();`
}
