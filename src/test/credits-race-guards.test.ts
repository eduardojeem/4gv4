import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Los datos de credito se recargan por varias vias a la vez: realtime, accion
 * del usuario y cambio de filtros o de cliente. Sin una guarda, una respuesta
 * anterior mas lenta llega despues y pisa la actual: en esta pantalla eso
 * significa mostrar el saldo de un cliente bajo el nombre de otro.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

const useCredits = read('src/hooks/use-credits.ts')
const useCustomerCredits = read('src/hooks/use-customer-credits.ts')

describe('use-credits', () => {
  it('numera cada carga para poder descartar las viejas', () => {
    expect(useCredits).toContain('loadSeqRef')
    expect(useCredits).toContain('const requestId = ++loadSeqRef.current')
  })

  it('descarta la respuesta si ya llego una carga mas nueva', () => {
    expect(useCredits).toContain('if (requestId !== loadSeqRef.current) return')
  })

  it('solo la carga vigente apaga el indicador', () => {
    // Si una carga vieja lo apagara, la pantalla diria "listo" con una consulta
    // todavia en curso.
    expect(useCredits).toContain('if (requestId === loadSeqRef.current) setLoading(false)')
  })
})

describe('use-customer-credits', () => {
  it('cancela el efecto de resumenes al cambiar la lista de clientes', () => {
    expect(useCustomerCredits).toContain('return () => { cancelled = true }')
  })

  it('no escribe resumenes de una consulta ya cancelada', () => {
    // Expresion regular en vez de texto literal: el archivo usa finales de
    // linea de Windows y comparar el salto exacto seria fragil.
    expect(useCustomerCredits).toMatch(/if \(cancelled\) return\s+setCreditSummaries\(summaries\)/)
  })

  it('conserva la guarda de montaje del detalle por cliente', () => {
    // Esta ya existia y no debe perderse al tocar el archivo.
    expect(useCustomerCredits).toContain('isMounted = false')
  })
})
