import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error: script de Node en .mjs, sin tipos
import { findHeavyRoutes, findOversizedAssets, firstLoadChunks, normalizeChunkPath } from '../../scripts/bundle-budgets.mjs'

const KB = 1024

/**
 * El chequeo post-build marcaba archivos de mas de 600 KB en disco. El CSS de
 * Tailwind pasaba el MB y comprimia a ~108 KB, asi que avisaba siempre, y no
 * veia rutas con 3 MB de JS repartidos en chunks chicos.
 */
describe('los presupuestos del build', () => {
  const tamanos: Record<string, number> = {
    'a.css': 140 * KB,
    'b.css': 160 * KB,
    'c.js': 240 * KB,
    'd.js': 320 * KB,
    'logo.png': 900 * KB,
  }
  const medir = (archivo: string) => tamanos[archivo]

  it('mide comprimido y separa JS de CSS', () => {
    const grandes = findOversizedAssets(Object.keys(tamanos), { js: 250 * KB, css: 150 * KB }, medir)

    expect(grandes.map((g: { file: string }) => g.file)).toEqual(['d.js', 'b.css'])
    // Un CSS de 140 KB comprimido esta bien aunque pese un MB en disco.
    expect(grandes.some((g: { file: string }) => g.file === 'a.css')).toBe(false)
  })

  it('las imagenes no tienen presupuesto aca: ya vienen comprimidas', () => {
    const grandes = findOversizedAssets(['logo.png'], { js: 1, css: 1 }, medir)
    expect(grandes).toEqual([])
  })

  it('suma los chunks de cada ruta, con las barras de Windows', () => {
    const stats = [
      { route: '/admin/reports', firstLoadChunkPaths: ['.next\\static\\chunks\\base.js', '.next\\static\\chunks\\export.js'] },
      { route: '/inicio', firstLoadChunkPaths: ['.next\\static\\chunks\\base.js'] },
      { route: '/vieja', firstLoadChunkPaths: ['.next\\static\\chunks\\borrado.js', '.next\\static\\chunks\\estilos.css'] },
    ]
    const pesos: Record<string, number> = {
      '.next/static/chunks/base.js': 500 * KB,
      '.next/static/chunks/export.js': 450 * KB,
    }
    const existe = (ruta: string) => ruta in pesos

    const pesadas = findHeavyRoutes(stats, 900 * KB, (ruta: string) => pesos[ruta], existe)

    expect(pesadas).toEqual([{ route: '/admin/reports', gzip: 950 * KB }])
  })

  /**
   * Diferir SheetJS dejo su chunk de 308 KB en disco, pero ninguna ruta lo
   * carga de entrada. Si el presupuesto por archivo lo siguiera contando, la
   * advertencia no se iria nunca aunque ya no hubiera nada que arreglar.
   */
  it('distingue lo que se carga de entrada de lo que se baja bajo demanda', () => {
    const stats = [
      { route: '/admin/reports', firstLoadChunkPaths: ['.next\\static\\chunks\\base.js', '.next\\static\\chunks\\reports.js'] },
      { route: '/inicio', firstLoadChunkPaths: ['.next\\static\\chunks\\base.js'] },
    ]
    const iniciales = firstLoadChunks(stats)

    expect([...iniciales].sort()).toEqual(['.next/static/chunks/base.js', '.next/static/chunks/reports.js'])
    expect(iniciales.has(normalizeChunkPath('.next\\static\\chunks\\sheetjs.js'))).toBe(false)
  })

  it('el script se engancha despues del build', () => {
    const paquete = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    expect(paquete.scripts.postbuild).toContain('post-build-checks.mjs')
  })
})
