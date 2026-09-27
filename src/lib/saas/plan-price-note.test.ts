import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPlanPriceNote } from './plan-price-note'

/**
 * Caso real: una migración le puso "Siempre gratis" al tier `free` cuando de
 * verdad era gratis. Después el plan se repricció a 45.000 y se renombró
 * "Lite", pero la nota siguió ahí — el formulario la precarga con lo que ya
 * había, así que sobrevivió a la edición y se publicó en la página de planes y
 * en el registro como «₲ 45.000 /Siempre gratis».
 */
describe('coherencia entre precio y nota', () => {
  it('marca un plan pago que dice ser gratis', () => {
    const r = checkPlanPriceNote(45000, 'Siempre gratis')
    expect(r.ok).toBe(false)
    if (r.ok === false) {
      expect(r.sugerencia).toBe('por mes')
      expect(r.mensaje).toContain('Siempre gratis')
    }
  })

  it('marca un plan gratuito con nota de período', () => {
    const r = checkPlanPriceNote(0, 'por mes')
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.sugerencia).toBe('Siempre gratis')
  })

  it('acepta las combinaciones correctas', () => {
    expect(checkPlanPriceNote(45000, 'por mes').ok).toBe(true)
    expect(checkPlanPriceNote(0, 'Siempre gratis').ok).toBe(true)
    expect(checkPlanPriceNote(300000, 'anual').ok).toBe(true)
  })

  it('no molesta con una nota promocional legítima', () => {
    // Este es el motivo de avisar en vez de bloquear: la palabra "gratis"
    // aparece en notas perfectamente válidas de un plan pago.
    for (const nota of ['primer mes gratis', '3 meses gratis al pagar anual', 'incluye envío gratis']) {
      expect(checkPlanPriceNote(45000, nota).ok, nota).toBe(true)
    }
  })

  it('ignora mayúsculas y espacios de más', () => {
    expect(checkPlanPriceNote(45000, '  SIEMPRE   GRATIS  ').ok).toBe(false)
  })

  it('no dice nada si la nota está vacía', () => {
    // Sin nota se imprime el valor por defecto de cada pantalla; no hay
    // contradicción que señalar.
    expect(checkPlanPriceNote(45000, '').ok).toBe(true)
    expect(checkPlanPriceNote(0, '   ').ok).toBe(true)
  })

  it('trata un precio no numérico como 0, igual que al guardar', () => {
    // El formulario guarda `Number(price) || 0`, así que la revisión tiene que
    // juzgar el mismo valor que se va a persistir: con 0, "Siempre gratis" es la
    // nota correcta y "por mes" la contradictoria.
    expect(checkPlanPriceNote(Number('x'), 'Siempre gratis').ok).toBe(true)
    expect(checkPlanPriceNote(Number('x'), 'por mes').ok).toBe(false)
  })
})

describe('el aviso está en los dos formularios', () => {
  const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

  it.each([
    'src/components/superadmin/plan-edit-sheet.tsx',
    'src/components/superadmin/plan-create-sheet.tsx',
  ])('%s avisa y ofrece corregirlo', (ruta) => {
    const fuente = leer(ruta)
    expect(fuente).toContain('checkPlanPriceNote')
    expect(fuente).toContain('avisoNota.mensaje')
    expect(fuente).toContain('setPriceNote(avisoNota.sugerencia)')
    // Es un aviso, no un bloqueo: nada debe impedir guardar.
    expect(fuente).not.toMatch(/disabled=\{[^}]*avisoNota/)
  })
})
