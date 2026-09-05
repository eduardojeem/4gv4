import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEVICE_ACCENTS,
  describeDeviceName,
  describeDeviceSummary,
  deviceAccent,
} from './device-label'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const FORMULARIO = leer('src/components/dashboard/repair-form-dialog-v2.tsx')

/**
 * La tarjeta mostraba marca y modelo sólo cuando estaban los dos completos, así
 * que mientras se cargaban tres equipos los tres decían «Dispositivo 1», «2» y
 * «3» y nada más.
 */
describe('el resumen aparece con lo que haya', () => {
  it('con la marca sola', () => {
    expect(describeDeviceSummary({ brand: 'Samsung' })).toBe('Samsung')
  })

  it('con el modelo solo', () => {
    expect(describeDeviceSummary({ model: 'A54' })).toBe('A54')
  })

  it('con marca y modelo', () => {
    expect(describeDeviceSummary({ brand: 'Samsung', model: 'A54' })).toBe('Samsung A54')
  })

  it('no dice nada cuando todavía no hay nada', () => {
    // Un renglón con un guion suelto no ayuda a nadie.
    expect(describeDeviceSummary({})).toBe('')
    expect(describeDeviceSummary({ brand: '   ', model: null })).toBe('')
  })
})

/**
 * Cuando el cliente trae dos equipos del mismo modelo, marca y modelo no
 * alcanzan: lo que los separa es la serie o la falla.
 */
describe('dos equipos iguales se distinguen igual', () => {
  it('la serie entra en el resumen', () => {
    expect(describeDeviceSummary({ brand: 'Apple', model: 'iPhone 11', serialNumber: 'F2LX9' }))
      .toBe('Apple iPhone 11 · Nº F2LX9')
  })

  it('la falla también, que es como los nombra quien atiende', () => {
    expect(describeDeviceSummary({ brand: 'Apple', model: 'iPhone 11', issue: 'No carga' }))
      .toBe('Apple iPhone 11 · No carga')
  })

  it('sirve aunque solo esté la falla', () => {
    expect(describeDeviceSummary({ issue: 'Pantalla rota' })).toBe('Pantalla rota')
  })

  it('recorta una falla larga en vez de romper el renglón', () => {
    const largo = describeDeviceSummary({ brand: 'LG', issue: 'x'.repeat(90) })
    expect(largo).toContain('…')
    expect(largo.length).toBeLessThan(60)
  })
})

describe('un color por equipo', () => {
  it('los primeros cinco son distintos', () => {
    const colores = [0, 1, 2, 3, 4].map((i) => deviceAccent(i).badge)
    expect(new Set(colores).size).toBe(5)
  })

  it('se repite después, sin romper', () => {
    expect(deviceAccent(5)).toEqual(DEVICE_ACCENTS[0])
    expect(deviceAccent(12)).toEqual(DEVICE_ACCENTS[2])
  })
})

describe('el formulario lo usa', () => {
  it('el resumen ya no exige marca y modelo juntos', () => {
    expect(FORMULARIO).toContain('const resumen = describeDeviceSummary({')
    expect(FORMULARIO).not.toContain("watch(`devices.${index}.brand`) && watch(`devices.${index}.model`)")
  })

  it('avisa cuando un equipo todavía no se puede identificar', () => {
    expect(FORMULARIO).toContain('sin identificar todavía')
  })

  it('el color y el borde solo aparecen con varios equipos', () => {
    // Con un solo equipo no hay nada que distinguir y el color seria ruido.
    expect(FORMULARIO).toContain('const varios = fields.length > 1')
    expect(FORMULARIO).toContain('varios && `border-l-4 ${accent.edge}`')
  })

  it('hay una tira arriba con todos los equipos', () => {
    expect(FORMULARIO).toContain('{fields.length > 1 && (')
    expect(FORMULARIO).toContain("nombre || 'sin completar'")
  })
})
