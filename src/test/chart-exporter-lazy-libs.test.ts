import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const EXPORTADOR = readFileSync(join(process.cwd(), 'src/components/reports/ChartExporter.tsx'), 'utf8')

/**
 * ChartExporter esta en /admin/analytics y /admin/reports. Con estas librerias
 * importadas arriba del archivo, viajaban en la primera carga de las dos rutas
 * —el chunk de 883 KB del build— aunque solo se usan al exportar.
 *
 * html2canvas ya no se usa: los graficos del PDF los dibuja
 * `canvas-chart-renderer`, que ademas funciona con la pestaña en segundo
 * plano. Se sigue comprobando que no vuelva a entrar.
 */
describe('las librerias de exportacion se piden al exportar', () => {
  const perezosas = ['jspdf', 'jspdf-autotable', 'xlsx-js-style']
  const librerias = ['html2canvas', ...perezosas]

  it.each(librerias)('%s no se importa arriba del archivo', (libreria) => {
    expect(EXPORTADOR).not.toMatch(new RegExp(`^import\\s+[^;]*from\\s+['"]${libreria}['"]`, 'm'))
  })

  it.each(perezosas)('%s se carga con import() dinamico', (libreria) => {
    expect(EXPORTADOR).toContain(`import('${libreria}')`)
  })

  it('html2canvas quedo fuera del paquete', () => {
    expect(EXPORTADOR).not.toContain("import('html2canvas')")
    expect(EXPORTADOR).toContain("from '@/lib/reports/canvas-chart-renderer'")
  })

  it('cada exportacion pide lo suyo antes de usarlo', () => {
    expect(EXPORTADOR).toContain('const { jsPDF, autoTable } = await loadPdfLibraries()')
    expect(EXPORTADOR).toContain('const XLSXStyle = await loadXlsxStyle()')
  })
})
