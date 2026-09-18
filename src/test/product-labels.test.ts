import { describe, expect, it } from 'vitest'
import {
  detectBarcodeFormat,
  ean13CheckDigit,
  isValidEan13,
  resolveLabelCode,
} from '@/lib/labels/barcode-format'
import { barcodeSvgMarkup, clearBarcodeSvgCache } from '@/lib/labels/barcode-svg'
import {
  LABEL_LAYOUTS,
  labelsPerPage,
  layoutOrDefault,
  paginateLabels,
  sheetsNeeded,
} from '@/lib/labels/label-layouts'
import {
  MAX_LABELS,
  buildLabelSheetHtml,
  prepareLabels,
  type LabelFields,
  type PreparedLabel,
} from '@/lib/labels/label-sheet'

const CAMPOS: LabelFields = { showName: true, showPrice: true, showCode: true, showSku: true }

/**
 * El sistema generaba el número del código de barras y lo leía con la pistola,
 * pero no había forma de imprimir la etiqueta. Un dígito verificador mal
 * calculado imprime un pliego entero que ningún lector acepta.
 */
describe('qué simbología le toca a cada código', () => {
  it('calcula el dígito verificador de un EAN-13', () => {
    // El ejemplo canónico: 590123412345 + 7.
    expect(ean13CheckDigit('590123412345')).toBe(7)
    expect(isValidEan13('5901234123457')).toBe(true)
    expect(isValidEan13('5901234123456')).toBe(false)
    expect(ean13CheckDigit('59012341234')).toBeNull()
  })

  it('un código de 13 dígitos válido sale como EAN-13', () => {
    expect(detectBarcodeFormat('5901234123457')).toBe('EAN13')
  })

  it('con el verificador equivocado no se hace pasar por EAN-13', () => {
    // Se imprime igual, pero como Code 128: el lector lo toma y nadie pierde
    // el pliego por un dígito mal tipeado.
    expect(detectBarcodeFormat('5901234123456')).toBe('CODE128')
  })

  it('reconoce UPC de 12 y EAN-8', () => {
    expect(detectBarcodeFormat('036000291452')).toBe('UPC')
    expect(detectBarcodeFormat('96385074')).toBe('EAN8')
  })

  it('un SKU con letras sale como Code 128 y lo que no es ASCII no sale', () => {
    expect(detectBarcodeFormat('CEL-IPH14-128')).toBe('CODE128')
    expect(detectBarcodeFormat('REMERA-Ñ')).toBeNull()
    expect(detectBarcodeFormat('   ')).toBeNull()
    expect(detectBarcodeFormat(null)).toBeNull()
  })

  it('usa el código de barras y, si no hay, el SKU', () => {
    expect(resolveLabelCode({ barcode: '5901234123457', sku: 'ABC-1' })).toEqual({
      value: '5901234123457',
      format: 'EAN13',
    })
    expect(resolveLabelCode({ barcode: '  ', sku: 'ABC-1' })).toEqual({ value: 'ABC-1', format: 'CODE128' })
    expect(resolveLabelCode({ barcode: null, sku: null })).toBeNull()
  })
})

describe('el dibujo del código', () => {
  it('devuelve un SVG para un EAN-13', async () => {
    clearBarcodeSvgCache()
    const markup = await barcodeSvgMarkup('5901234123457')
    expect(markup).toBeTruthy()
    expect(markup).toContain('<svg')
    expect(markup).toContain('http://www.w3.org/2000/svg')
  })

  it('un EAN-13 con verificador malo se dibuja como Code 128 en vez de fallar', async () => {
    clearBarcodeSvgCache()
    const markup = await barcodeSvgMarkup('5901234123456', { format: 'EAN13' })
    expect(markup).toContain('<svg')
  })

  it('sin código no hay dibujo', async () => {
    expect(await barcodeSvgMarkup('')).toBeNull()
  })
})

describe('formatos de etiqueta', () => {
  it('el rollo es continuo y la hoja tiene grilla', () => {
    const rollo = layoutOrDefault('termica-50x25')
    expect(rollo.media).toBe('thermal')
    expect(labelsPerPage(rollo)).toBeNull()

    const hoja = layoutOrDefault('a4-24')
    expect(labelsPerPage(hoja)).toBe(24)
    expect(sheetsNeeded(hoja, 30)).toBe(2)
    expect(sheetsNeeded(hoja, 0)).toBe(0)
  })

  it('un id que no existe cae en el formato por defecto', () => {
    expect(layoutOrDefault('no-existe').id).toBe('termica-50x25')
  })

  /** Si la grilla no entra en la hoja, cada etiqueta se corre del adhesivo. */
  it('las etiquetas entran en su hoja', () => {
    for (const layout of LABEL_LAYOUTS) {
      const ancho = layout.columns * layout.labelWidthMm + (layout.columns - 1) * layout.gapXMm + layout.marginXMm * 2
      expect(ancho, `${layout.id} a lo ancho`).toBeLessThanOrEqual(layout.pageWidthMm + 0.01)

      if (layout.rows !== null && layout.pageHeightMm !== null) {
        const alto = layout.rows * layout.labelHeightMm + (layout.rows - 1) * layout.gapYMm + layout.marginYMm * 2
        expect(alto, `${layout.id} a lo alto`).toBeLessThanOrEqual(layout.pageHeightMm + 0.01)
      }
    }
  })

  it('reparte las etiquetas por hoja y deja el rollo en una tirada', () => {
    const etiquetas = Array.from({ length: 30 }, (_, index) => index)
    const hojas = paginateLabels(etiquetas, layoutOrDefault('a4-24'))
    expect(hojas).toHaveLength(2)
    expect(hojas[0]).toHaveLength(24)
    expect(hojas[1]).toHaveLength(6)

    expect(paginateLabels(etiquetas, layoutOrDefault('termica-50x25'))).toHaveLength(1)
  })
})

describe('preparar las etiquetas de los productos', () => {
  const producto = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    name: 'Cargador USB-C 25W',
    sku: 'CAR-25W',
    barcode: '5901234123457',
    price: 55000,
    quantity: 1,
    ...over,
  })

  it('repite cada producto tantas veces como se pidió', async () => {
    const { labels } = await prepareLabels(
      [producto({ quantity: 3 }), producto({ id: 'p2', name: 'Funda', quantity: 2 })],
      layoutOrDefault('a4-24'),
    )
    expect(labels).toHaveLength(5)
    expect(labels.filter((label) => label.productId === 'p1')).toHaveLength(3)
  })

  it('el producto sin código de barras ni SKU queda afuera y se avisa', async () => {
    const { labels, withoutCode } = await prepareLabels(
      [producto(), producto({ id: 'p2', name: 'Producto suelto', sku: '', barcode: null })],
      layoutOrDefault('a4-24'),
    )
    expect(labels).toHaveLength(1)
    expect(withoutCode).toEqual(['Producto suelto'])
  })

  it('no imprime más que el tope de seguridad', async () => {
    const { labels, truncated } = await prepareLabels(
      [producto({ quantity: MAX_LABELS + 50 })],
      layoutOrDefault('a4-24'),
    )
    expect(labels).toHaveLength(MAX_LABELS)
    expect(truncated).toBe(true)
  })

  it('un precio en cero no se imprime como precio', async () => {
    const { labels } = await prepareLabels([producto({ price: 0 })], layoutOrDefault('a4-24'))
    expect(labels[0].priceLabel).toBeNull()
  })

  it('cantidad cero significa que ese producto no se imprime', async () => {
    const { labels } = await prepareLabels([producto({ quantity: 0 })], layoutOrDefault('a4-24'))
    expect(labels).toHaveLength(0)
  })
})

describe('la hoja imprimible', () => {
  const etiqueta = (over: Partial<PreparedLabel> = {}): PreparedLabel => ({
    productId: 'p1',
    name: 'Cargador USB-C 25W',
    priceLabel: 'Gs. 55.000',
    code: '5901234123457',
    sku: 'CAR-25W',
    barcodeSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    ...over,
  })

  it('el papel del rollo mide lo que la etiqueta', () => {
    const html = buildLabelSheetHtml([etiqueta()], layoutOrDefault('termica-50x25'), CAMPOS)
    expect(html).toContain('@page { size: 50mm 25mm; margin: 0; }')
  })

  it('la tira de la impresora de tickets no fija el largo del papel', () => {
    const html = buildLabelSheetHtml([etiqueta()], layoutOrDefault('termica-80mm'), CAMPOS)
    expect(html).toContain('@page { size: 80mm auto; margin: 0; }')
  })

  it('cada hoja A4 lleva su salto de página', () => {
    const etiquetas = Array.from({ length: 25 }, () => etiqueta())
    const html = buildLabelSheetHtml(etiquetas, layoutOrDefault('a4-24'), CAMPOS)
    expect(html.match(/class="page"/g)).toHaveLength(2)
    expect(html.match(/class="label"/g)).toHaveLength(25)
    expect(html).toContain('grid-template-columns: repeat(3, 70mm)')
  })

  it('imprime lo que se pidió y nada más', () => {
    const solosCodigos: LabelFields = { showName: false, showPrice: false, showCode: true, showSku: false }
    const html = buildLabelSheetHtml([etiqueta()], layoutOrDefault('a4-24'), solosCodigos)
    expect(html).toContain('5901234123457')
    expect(html).not.toContain('Cargador USB-C 25W')
    expect(html).not.toContain('Gs. 55.000')
    expect(html).not.toContain('CAR-25W')
  })

  /** El nombre lo escribe una persona: no puede terminar ejecutándose. */
  it('escapa el nombre del producto', () => {
    const html = buildLabelSheetHtml(
      [etiqueta({ name: '<script>alert(1)</script>' })],
      layoutOrDefault('a4-24'),
      CAMPOS,
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('sin dibujo queda el número, no un hueco', () => {
    const html = buildLabelSheetHtml([etiqueta({ barcodeSvg: null })], layoutOrDefault('a4-24'), CAMPOS)
    expect(html).toContain('barcode--missing')
    expect(html).toContain('5901234123457')
  })

  it('el borde punteado es opcional, para probar en papel común', () => {
    const conGuias = buildLabelSheetHtml([etiqueta()], layoutOrDefault('a4-24'), { ...CAMPOS, showGuides: true })
    expect(conGuias).toContain('dashed')
    expect(buildLabelSheetHtml([etiqueta()], layoutOrDefault('a4-24'), CAMPOS)).not.toContain('dashed')
  })

  it('el SKU no se repite cuando es el mismo código', () => {
    const html = buildLabelSheetHtml(
      [etiqueta({ code: 'CAR-25W', sku: 'CAR-25W' })],
      layoutOrDefault('a4-24'),
      CAMPOS,
    )
    expect(html.match(/CAR-25W/g)).toHaveLength(1)
  })
})
