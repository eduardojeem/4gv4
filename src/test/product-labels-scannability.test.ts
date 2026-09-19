import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LABEL_LAYOUTS, layoutOrDefault } from '@/lib/labels/label-layouts'
import {
  MIN_MODULE_MM,
  RECOMMENDED_MODULE_MM,
  barcodeModules,
  maxCode128Length,
  rateScannability,
  smallestLayoutThatFits,
} from '@/lib/labels/scannability'
import {
  INTERNAL_EAN_PREFIX,
  assignInternalBarcodes,
  buildInternalEan13,
  generateInternalEan13,
} from '@/lib/labels/internal-barcode'
import { isValidEan13 } from '@/lib/labels/barcode-format'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * De los 351 productos activos, 344 se imprimen con el SKU como Code 128 y 132
 * de ellos bajan de 0,19 mm en el rollo de 50 × 25: el lector no los toma. Eso
 * antes se descubría con el pliego ya impreso.
 */
describe('cuánto mide la barra fina', () => {
  it('cuenta los módulos de cada simbología', () => {
    expect(barcodeModules('5901234123457', 'EAN13')).toBe(95)
    expect(barcodeModules('036000291452', 'UPC')).toBe(95)
    expect(barcodeModules('96385074', 'EAN8')).toBe(67)
    // Code 128: 11 por carácter más 35 de arranque, verificador y cierre.
    expect(barcodeModules('ABC', 'CODE128')).toBe(68)
    expect(barcodeModules('PROD-MT1WHVV8-J786', 'CODE128')).toBe(11 * 18 + 35)
  })

  it('un EAN-13 se lee hasta en la etiqueta más chica', () => {
    const rating = rateScannability('5901234123457', layoutOrDefault('termica-50x25'))
    expect(rating?.level).toBe('ok')
    expect(rating?.moduleMm).toBeGreaterThan(RECOMMENDED_MODULE_MM)
  })

  /** El SKU autogenerado del sistema: 18 caracteres. */
  it('un SKU de 18 caracteres no se lee en el rollo de 50 × 25', () => {
    const rating = rateScannability('PROD-MT1WHVV8-J786', layoutOrDefault('termica-50x25'))
    expect(rating?.level).toBe('risky')
    expect(rating?.moduleMm).toBeLessThan(MIN_MODULE_MM)
  })

  it('el mismo SKU sí entra en una etiqueta más grande', () => {
    const sugerido = smallestLayoutThatFits('PROD-MT1WHVV8-J786', LABEL_LAYOUTS)
    expect(sugerido).not.toBeNull()
    expect(rateScannability('PROD-MT1WHVV8-J786', sugerido!)?.level).toBe('ok')
    // Y el sugerido es el más chico que sirve, no el más grande de todos.
    const masChicos = LABEL_LAYOUTS.filter((item) => item.labelWidthMm < sugerido!.labelWidthMm)
    for (const item of masChicos) {
      expect(rateScannability('PROD-MT1WHVV8-J786', item)?.level, item.id).not.toBe('ok')
    }
  })

  it('dice cuántos caracteres entran en cada etiqueta', () => {
    expect(maxCode128Length(layoutOrDefault('termica-50x25'))).toBe(17)
    expect(maxCode128Length(layoutOrDefault('a4-24'))).toBeGreaterThan(25)
  })

  it('sin código no hay medida', () => {
    expect(rateScannability('', layoutOrDefault('a4-24'))).toBeNull()
    expect(rateScannability('REMERA-Ñ', layoutOrDefault('a4-24'))).toBeNull()
  })
})

describe('códigos propios para los productos sin código', () => {
  /** 200–299 es el rango de circulación restringida: uso interno del negocio. */
  it('usa el prefijo de uso interno, no el de un país fabricante', () => {
    expect(INTERNAL_EAN_PREFIX).toBe('200')
    // 200 123456789 + verificador 3 (suma ponderada 97).
    const code = buildInternalEan13('123456789')
    expect(code).toBe('2001234567893')
    expect(isValidEan13(code!)).toBe(true)
  })

  it('el código generado siempre es un EAN-13 válido', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateInternalEan13(new Set())
      expect(code).not.toBeNull()
      expect(isValidEan13(code!)).toBe(true)
      expect(code!.startsWith('200')).toBe(true)
    }
  })

  /** Dos productos con el mismo código hacen que el POS cobre el equivocado. */
  it('no repite uno que ya está en uso', () => {
    const repetido = buildInternalEan13('000000000')!
    // Un azar que siempre devolvería el mismo código, salvo que esté tomado.
    let llamadas = 0
    const azar = () => {
      llamadas += 1
      return llamadas <= 3 ? 0 : 0.5
    }
    const code = generateInternalEan13(new Set([repetido]), azar)
    expect(code).not.toBe(repetido)
    expect(isValidEan13(code!)).toBe(true)
  })

  it('reparte códigos sin repetir entre ellos y no toca los que ya tienen', () => {
    const { assignments } = assignInternalBarcodes(
      [
        { id: 'p1', barcode: null },
        { id: 'p2', barcode: '  ' },
        { id: 'p3', barcode: '5901234123457' },
      ],
      new Set(),
    )
    expect(assignments.map((item) => item.id)).toEqual(['p1', 'p2'])
    expect(new Set(assignments.map((item) => item.barcode)).size).toBe(2)
  })
})

describe('el modal avisa antes de imprimir', () => {
  it('marca los productos cuyo código no se va a leer y ofrece la salida', () => {
    const dialogo = leer('src/components/dashboard/products/labels/PrintLabelsDialog.tsx')
    expect(dialogo).toContain('rateScannability(code.value, layout, code.format)')
    expect(dialogo).toContain('No va a leer')
    expect(dialogo).toContain('Generar código para')
    expect(dialogo).toContain('Usar {betterLayout.short}')
  })

  it('la API guarda el código sin pisar uno existente y solo en la organización', () => {
    const api = leer('src/app/api/products/barcodes/route.ts')
    expect(api).toContain("withTenantAuth(\n  { permission: 'products.update', module: 'inventory' }")
    expect(api).toContain(".eq('organization_id', organization.id)")
    expect(api).toContain(".is('barcode', null)")
    // Los códigos ya usados se juntan de productos y variantes.
    expect(api).toContain("admin.from('product_variants').select('barcode')")
  })
})
