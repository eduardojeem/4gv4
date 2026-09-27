/**
 * Cómo se llama y se codifica la copia de un producto.
 *
 * Duplicar armaba el SKU como `DUP-<sku>-<azar>`, así que duplicar una copia
 * encadenaba prefijos: en el catálogo hay uno de 34 caracteres,
 * `DUP-DUP-PROD-MT4OOD7K-972V-135-193`. Un código tan largo, impreso en una
 * etiqueta de 50 × 25 mm, sale con barras de 0,1 mm y ningún lector lo toma.
 * Lo mismo con el nombre: «Aire Midea 12.000 Btu (Copia) (Copia)».
 */

/** Saca los prefijos y sufijos que dejaron las copias anteriores. */
function raizDelSku(sku: string): string {
  let raiz = sku.trim()
  while (/^(DUP|COPIA|COPY)[-_]/i.test(raiz)) {
    raiz = raiz.replace(/^(DUP|COPIA|COPY)[-_]/i, '')
  }
  // Sufijo de copia anterior: «-C123».
  raiz = raiz.replace(/-C\d{1,4}$/i, '')
  return raiz
}

/**
 * El SKU de la copia: la raíz del original más un sufijo corto.
 *
 * Se recorta para que entre en una etiqueta chica: con Code 128, 17 caracteres
 * es el máximo que se lee en el rollo de 50 × 25 mm.
 */
export function duplicatedSku(sku: string | null | undefined, azar: () => number = Math.random): string {
  const sufijo = `-C${Math.floor(azar() * 900 + 100)}`
  const raiz = raizDelSku(sku ?? '') || 'PROD'
  const largoMaximo = 17 - sufijo.length
  return `${raiz.slice(0, largoMaximo)}${sufijo}`
}

/** El nombre de la copia, sin encadenar «(Copia)» una y otra vez. */
export function duplicatedName(name: string): string {
  let base = name.trim()
  // Los nombres que ya arrastran varias copias se limpian del todo.
  while (/\s*\((?:Copia|Copy)(?:\s*\d+)?\)$/i.test(base)) {
    base = base.replace(/\s*\((?:Copia|Copy)(?:\s*\d+)?\)$/i, '').trim()
  }
  return `${base || 'Producto'} (Copia)`
}

/**
 * Lo que cambia en una copia respecto del original.
 *
 * El código de barras identifica al producto en la caja: si la copia lo
 * arrastra, quedan dos productos con el mismo código y el lector no puede
 * distinguirlos. Y el stock es del original: la copia arranca en cero.
 */
export function duplicatedFields(
  producto: { sku?: string | null; name: string },
  azar: () => number = Math.random,
): { sku: string; name: string; barcode: null; stock_quantity: number } {
  return {
    sku: duplicatedSku(producto.sku, azar),
    name: duplicatedName(producto.name),
    barcode: null,
    stock_quantity: 0,
  }
}
