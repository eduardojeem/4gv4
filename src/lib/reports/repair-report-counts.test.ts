import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { calculateRepairCompletion } from './repair-report'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * El PDF de reparaciones salia con 120 ordenes, 0 finalizadas, 0 en proceso y
 * 89,2% de finalizacion: tres numeros que no pueden ser ciertos a la vez.
 *
 * El exportador pedia `metrics.completed` y `metrics.inProgress`, dos campos que
 * nadie calculaba. Como eran opcionales, TypeScript no decia nada, y
 * `formatNumber(undefined)` los imprimia como «0». La tasa si se calculaba, asi
 * que era el unico de los tres que estaba bien.
 */
describe('los conteos del informe de reparaciones', () => {
  const padron = [
    { status: 'entregado', receivedAt: '2026-08-01T12:00:00Z', completedAt: '2026-08-03T12:00:00Z' },
    { status: 'entregado', receivedAt: null, completedAt: null },
    { status: 'reparacion', receivedAt: '2026-08-02T12:00:00Z', completedAt: null },
    { status: 'diagnostico', receivedAt: '2026-08-02T12:00:00Z', completedAt: null },
    { status: 'listo', receivedAt: '2026-08-02T12:00:00Z', completedAt: '2026-08-04T12:00:00Z' },
    { status: 'cancelado', receivedAt: '2026-08-02T12:00:00Z', completedAt: null },
  ]

  it('cuenta las entregadas y las que estan en el taller', () => {
    const resultado = calculateRepairCompletion(padron)
    expect(resultado.deliveredCount).toBe(2)
    // En proceso son las que siguen en el taller: recibido, diagnostico,
    // reparacion y pausado. `listo` ya salio del taller y espera retiro;
    // `cancelado` no cuenta en ningun lado.
    expect(resultado.inProgressCount).toBe(2)
  })

  it('el conteo de entregadas es el numerador de la tasa', () => {
    // Este es el invariante que se habia roto: si salen de reglas distintas,
    // el informe vuelve a contradecirse solo.
    const resultado = calculateRepairCompletion(padron)
    expect(resultado.completionRate).toBeCloseTo((resultado.deliveredCount / padron.length) * 100)
  })

  it('un estado guardado con mayusculas o espacios igual cuenta', () => {
    // Antes se comparaba el texto crudo contra 'entregado': cualquier fila
    // guardada como «Entregado» quedaba afuera de las dos cosas.
    const resultado = calculateRepairCompletion([
      { status: ' Entregado ', receivedAt: null, completedAt: null },
      { status: 'REPARACION', receivedAt: null, completedAt: null },
    ])
    expect(resultado.deliveredCount).toBe(1)
    expect(resultado.inProgressCount).toBe(1)
  })

  it('sin reparaciones no divide por cero', () => {
    const resultado = calculateRepairCompletion([])
    expect(resultado.deliveredCount).toBe(0)
    expect(resultado.inProgressCount).toBe(0)
    expect(resultado.completionRate).toBe(0)
  })

  it('un estado desconocido no se cuenta en ninguno de los dos', () => {
    const resultado = calculateRepairCompletion([
      { status: 'estado_que_no_existe', receivedAt: null, completedAt: null },
      { status: null, receivedAt: null, completedAt: null },
    ])
    expect(resultado.deliveredCount).toBe(0)
    expect(resultado.inProgressCount).toBe(0)
  })
})

describe('el informe recibe los conteos que muestra', () => {
  it('la pantalla los calcula y los guarda', () => {
    const PAGINA = leer('src/app/dashboard/reports/page.tsx')
    expect(PAGINA).toContain('completed: completion.deliveredCount,')
    expect(PAGINA).toContain('inProgress: completion.inProgressCount,')
  })

  it('el exportador los pide obligatorios', () => {
    // Cuando eran opcionales nadie los pasaba y el PDF imprimia 0 sin que nada
    // avisara. Ahora falta uno y no compila.
    const EXPORTADOR = leer('src/lib/reports/section-pdf-exporter.ts')
    expect(EXPORTADOR).toContain('    completed: number\n    inProgress: number')
    expect(EXPORTADOR).not.toContain('completed?: number')
    expect(EXPORTADOR).not.toContain('inProgress?: number')
  })
})
