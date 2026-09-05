import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeSingleDeviceOnlyData, hasSingleDeviceOnlyData } from './multi-device-guard'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * El botón «Agregar» equipo estaba bloqueado desde que se abría el formulario.
 *
 * La condición comprobaba `finalCost !== null`, y el modo de precio automático
 * —el que viene por defecto— escribe `finalCost = 0` en el primer render, con la
 * orden todavía en blanco. `0 !== null` daba verdadero, así que nunca se podía
 * cargar un segundo equipo sin que nadie hubiera tocado nada.
 */
describe('el formulario en blanco deja agregar otro equipo', () => {
  it('un costo final en cero no bloquea', () => {
    // Es exactamente lo que deja el modo automático al abrir el formulario.
    expect(hasSingleDeviceOnlyData({ finalCost: 0 })).toBe(false)
  })

  it('tampoco bloquea el formulario recién abierto completo', () => {
    expect(hasSingleDeviceOnlyData({
      parts: [],
      notes: [],
      laborCost: 0,
      finalCost: 0,
      depositAmount: null,
    })).toBe(false)
  })

  it('ni un objeto vacío', () => {
    expect(hasSingleDeviceOnlyData({})).toBe(false)
  })
})

describe('sigue bloqueando cuando hay datos de una sola orden', () => {
  it('con repuestos o servicios', () => {
    expect(hasSingleDeviceOnlyData({ parts: [{}] })).toBe(true)
  })

  it('con notas', () => {
    expect(hasSingleDeviceOnlyData({ notes: [{}] })).toBe(true)
  })

  it('con mano de obra', () => {
    expect(hasSingleDeviceOnlyData({ laborCost: 50_000 })).toBe(true)
  })

  it('con un costo final de verdad', () => {
    expect(hasSingleDeviceOnlyData({ finalCost: 120_000 })).toBe(true)
  })

  it('con un adelanto', () => {
    expect(hasSingleDeviceOnlyData({ depositAmount: 30_000 })).toBe(true)
  })
})

/**
 * El mensaje anterior enumeraba las cuatro cosas posibles y dejaba a la persona
 * buscando cuál de todas era la que tenía cargada.
 */
describe('el aviso nombra lo que hay cargado', () => {
  it('nombra un solo dato', () => {
    expect(describeSingleDeviceOnlyData({ laborCost: 1 })).toBe('mano de obra')
  })

  it('une dos con "y"', () => {
    expect(describeSingleDeviceOnlyData({ parts: [{}], depositAmount: 1 }))
      .toBe('repuestos o servicios y un adelanto')
  })

  it('usa comas para tres o más', () => {
    expect(describeSingleDeviceOnlyData({ parts: [{}], notes: [{}], laborCost: 1 }))
      .toBe('repuestos o servicios, notas y mano de obra')
  })

  it('no dice nada si no hay nada', () => {
    expect(describeSingleDeviceOnlyData({ finalCost: 0 })).toBe('')
  })
})

describe('la condición vive en un solo lugar', () => {
  const formulario = leer('src/components/dashboard/repair-form-dialog-v2.tsx')
  const pagina = leer('src/app/dashboard/repairs/page.tsx')

  it('la usan el botón de agregar y el guardado', () => {
    // Estaba escrita dos veces, y las dos tenían el mismo error.
    expect(formulario).toContain('hasSingleDeviceOnlyData(values)')
    expect(pagina).toContain('hasSingleDeviceOnlyData(data)')
  })

  it('ya no queda la comparación contra null', () => {
    expect(formulario).not.toContain('values.finalCost !== null')
    expect(pagina).not.toContain('data.finalCost !== null')
  })
})
