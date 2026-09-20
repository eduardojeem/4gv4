import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { duplicatedFields, duplicatedName, duplicatedSku } from '@/lib/products/duplicate'

/**
 * Duplicar armaba el SKU como `DUP-<sku>-<azar>`: duplicar una copia encadenaba
 * prefijos y en el catálogo quedó uno de 34 caracteres. Impreso en una etiqueta
 * de 50 × 25 mm, un código así sale con barras de 0,1 mm y no lo lee nadie.
 */
describe('el código de la copia', () => {
  const azar = () => 0.5 // sufijo estable: -C550

  it('no encadena prefijos al duplicar una copia', () => {
    const primera = duplicatedSku('CAR-25W', azar)
    const segunda = duplicatedSku(primera, azar)
    expect(primera).toBe('CAR-25W-C550')
    expect(segunda).toBe('CAR-25W-C550')
    expect(segunda).not.toContain('DUP')
  })

  it('limpia los prefijos que dejó la forma vieja', () => {
    expect(duplicatedSku('DUP-DUP-PROD-MT4OOD7K', azar)).toBe('PROD-MT4OOD7-C550')
    expect(duplicatedSku('COPIA_ABC', azar)).toBe('ABC-C550')
  })

  /** Con Code 128, 17 caracteres es lo máximo que se lee en el rollo chico. */
  it('entra en la etiqueta más chica', () => {
    const largo = duplicatedSku('PROD-MT1WHVV8-J786-EXTRA-LARGO', azar)
    expect(largo.length).toBeLessThanOrEqual(17)
  })

  it('un producto sin SKU igual recibe uno', () => {
    expect(duplicatedSku('', azar)).toBe('PROD-C550')
    expect(duplicatedSku(null, azar)).toBe('PROD-C550')
  })
})

describe('el nombre de la copia', () => {
  it('no acumula «(Copia)»', () => {
    expect(duplicatedName('Aire Midea 12.000 Btu')).toBe('Aire Midea 12.000 Btu (Copia)')
    expect(duplicatedName('Aire Midea 12.000 Btu (Copia)')).toBe('Aire Midea 12.000 Btu (Copia)')
    expect(duplicatedName('Aire Midea (Copia) (Copia)')).toBe('Aire Midea (Copia)')
  })
})

describe('qué se lleva la copia', () => {
  /** Dos productos con el mismo código hacen que el POS cobre el equivocado. */
  it('no arrastra el código de barras del original', () => {
    expect(duplicatedFields({ sku: 'CAR-25W', name: 'Cargador' }).barcode).toBeNull()
  })

  it('arranca sin stock: el del original no es suyo', () => {
    expect(duplicatedFields({ sku: 'CAR-25W', name: 'Cargador' }).stock_quantity).toBe(0)
  })

  it('la pantalla de productos usa estas reglas', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/dashboard/products/page.tsx'), 'utf8')
    expect(page).toContain('...duplicatedFields(product)')
    expect(page).not.toContain('sku: `DUP-${product.sku}')
  })
})
