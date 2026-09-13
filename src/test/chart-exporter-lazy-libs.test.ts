import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const EXPORTADOR = readFileSync(join(process.cwd(), 'src/components/reports/ChartExporter.tsx'), 'utf8')

/**
 * ChartExporter esta en /admin/analytics y /admin/reports. Con estas cuatro
 * librerias importadas arriba del archivo, viajaban en la primera carga de las
 * dos rutas —el chunk de 883 KB del build— aunque solo se usan al exportar.
 */
describe('las librerias de exportacion se piden al exportar', () => {
  const librerias = ['html2canvas', 'jspdf', 'jspdf-autotable', 'xlsx-js-style']

  it.each(librerias)('%s no se importa arriba del archivo', (libreria) => {
    expect(EXPORTADOR).not.toMatch(new RegExp(`^import\\s+[^;]*from\\s+['"]${libreria}['"]`, 'm'))
  })

  it.each(librerias)('%s se carga con import() dinamico', (libreria) => {
    expect(EXPORTADOR).toContain(`import('${libreria}')`)
  })

  it('cada exportacion pide lo suyo antes de usarlo', () => {
    expect(EXPORTADOR).toContain('const html2canvas = await loadHtml2Canvas()')
    expect(EXPORTADOR).toContain('const { jsPDF, autoTable } = await loadPdfLibraries()')
    expect(EXPORTADOR).toContain('const XLSXStyle = await loadXlsxStyle()')
  })
})
