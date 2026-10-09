import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'src/app/dashboard/page.tsx'), 'utf8')

describe('panel en el celular', () => {
  it('los indicadores van de a dos por fila', () => {
    expect(page).toContain('grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3')
  })

  it('las acciones del encabezado se deslizan en una fila sin ensanchar la página', () => {
    // Sin «relative», el texto oculto de Actualizar se salía de la fila y la página se desbordaba.
    expect(page).toContain('relative -mx-4 flex items-center gap-2 overflow-x-auto')
  })

  it('el resumen del taller muestra los tres montos en una fila', () => {
    expect(page).toContain('mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-4')
  })
})
