import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Las tarjetas de "en mora", "vencen hoy" y "creditos activos" son los accesos
 * rapidos a la cobranza, la accion mas frecuente de la pantalla. Llevaban
 * onClick sobre un <Card>, que se renderiza como <div>: no se alcanzaban con el
 * tabulador ni un lector de pantalla las anunciaba como accionables.
 */
const source = readFileSync(resolve(process.cwd(), 'src/app/dashboard/credits/page.tsx'), 'utf8')

describe('accesibilidad de los filtros rapidos de credito', () => {
  it('las tres tarjetas accionables se anuncian como boton', () => {
    expect(source.match(/role="button"/g) ?? []).toHaveLength(3)
  })

  it('se pueden alcanzar con el tabulador', () => {
    expect(source.match(/tabIndex=\{0\}/g) ?? []).toHaveLength(3)
  })

  it('responden a Enter y Espacio, no solo al clic', () => {
    // Un boton nativo responde a ambas teclas; al emular uno con un div hay que
    // reproducir ese comportamiento a mano.
    expect(source.match(/onKeyDown=/g) ?? []).toHaveLength(3)
    expect(source).toContain("event.key === 'Enter' || event.key === ' '")
  })

  it('cada una dice que filtro aplica', () => {
    // Sin esto el lector de pantalla solo leeria las cifras, sin explicar que
    // la tarjeta hace algo al activarse.
    expect(source).toContain('aria-label="Filtrar y ver las cuotas en mora o vencidas"')
    expect(source).toContain('aria-label="Filtrar y ver las cuotas que vencen hoy"')
    expect(source).toContain('aria-label="Ver todos los créditos activos"')
  })

  it('el foco de teclado es visible', () => {
    // Sin indicador visible, quien navega con teclado no sabe donde esta parado.
    expect(source.match(/focus-visible:ring-2/g) ?? []).toHaveLength(3)
  })
})
