import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { chartPointLabel, chartPointValue } from './chart-points'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * `/admin/analytics` reventaba al exportar el PDF:
 *
 *   Cannot read properties of undefined (reading 'length')
 *   at renderDonutChartCanvas (canvas-chart-renderer.ts:326)
 *
 * El panel de admin arma sus series como `{ label, value }` y el exportador leia
 * `d.name` y `d.sales`, que son las claves de la pagina de reportes. El punto
 * llegaba con `label: undefined` y el renderer se caia al medir su largo. Los
 * graficos que no se caian se dibujaban en cero.
 */
describe('los puntos se leen de los dos tableros', () => {
  it('toma la clave de la pagina de reportes', () => {
    expect(chartPointLabel({ name: 'Entregado', value: 3 }, 'x')).toBe('Entregado')
    expect(chartPointValue({ name: 'Accesorios', sales: 120_000 })).toBe(120_000)
  })

  it('y tambien la del panel de admin', () => {
    expect(chartPointLabel({ label: 'Sucursal Centro', value: 5 }, 'x')).toBe('Sucursal Centro')
    expect(chartPointValue({ label: 'Sucursal Centro', value: 5 })).toBe(5)
  })

  it('una fecha sirve de etiqueta cuando no hay nombre', () => {
    expect(chartPointLabel({ date: '2026-09-01', count: 4 }, 'x')).toBe('2026-09-01')
    expect(chartPointValue({ date: '2026-09-01', count: 4 })).toBe(4)
  })

  it('sin ninguna clave usa el respaldo en vez de romper', () => {
    // Este era el crash: el punto llegaba sin `label` y el renderer media su largo.
    expect(chartPointLabel({ algo: 'otra cosa' }, 'Sin dato')).toBe('Sin dato')
    expect(chartPointLabel(undefined, 'Sin dato')).toBe('Sin dato')
    expect(chartPointLabel(null, 'Sin dato')).toBe('Sin dato')
    expect(chartPointLabel({ label: '   ' }, 'Sin dato')).toBe('Sin dato')
  })

  it('un valor que no es numero no ensucia el canvas', () => {
    // `NaN` en una coordenada no dibuja nada y no avisa: peor que un cero.
    expect(chartPointValue({ value: 'no es un numero' })).toBe(0)
    expect(chartPointValue({})).toBe(0)
    expect(chartPointValue(undefined)).toBe(0)
    expect(Number.isFinite(chartPointValue({ value: Infinity }))).toBe(true)
  })

  it('un cero real se respeta', () => {
    expect(chartPointValue({ value: 0 })).toBe(0)
    expect(chartPointValue({ sales: 0, value: 99 })).toBe(0)
  })
})

describe('el renderer no puede caerse por una etiqueta que falta', () => {
  const RENDERER = leer('src/lib/reports/canvas-chart-renderer.ts')

  it('mide el largo sobre un texto, no sobre lo que venga', () => {
    expect(RENDERER).not.toContain('item.label.length')
    expect(RENDERER.match(/const rawLabel = String\(item\.label \?\? ''\)/g)).toHaveLength(2)
  })

  it('las etiquetas del eje tambien', () => {
    expect(RENDERER).toContain("ctx.fillText(String(p.label ?? ''), p.x, height - 12)")
  })
})

describe('el exportador usa los normalizadores en todos los graficos', () => {
  const EXPORTADOR = leer('src/components/reports/ChartExporter.tsx')

  it('ninguno lee las claves crudas', () => {
    expect(EXPORTADOR).not.toContain('label: d.name,')
    expect(EXPORTADOR).not.toContain("label: d.name || 'Sin nombre'")
    expect(EXPORTADOR).not.toContain("label: d.name || 'Sin categoría'")
  })

  it('los seis pasan por el mismo camino', () => {
    expect(EXPORTADOR.match(/pointLabel\(d, /g)).toHaveLength(6)
    expect(EXPORTADOR.match(/value: pointValue\(d\)/g)).toHaveLength(6)
  })
})
