/**
 * Utilidad profesional para exportación de reportes CSV en POS y Caja
 * Compatible con Microsoft Excel, Google Sheets y LibreOffice (UTF-8 con BOM)
 */

export interface CsvExportOptions {
  filename: string
  title: string
  subtitle?: string
  generatedBy?: string
  summaryStats?: Array<{ label: string; value: string | number }>
  headers: string[]
  rows: Array<Array<string | number | null | undefined>>
  footerTotals?: Array<string | number | null | undefined>
}

export function downloadCsvReport({
  filename,
  title,
  subtitle,
  generatedBy,
  summaryStats = [],
  headers,
  rows,
  footerTotals
}: CsvExportOptions) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const lines: string[] = []

  // 1. Banner de Encabezado Institucional
  lines.push([escapeCell('SISTEMA DE GESTIÓN COMERCIAL & POS'), escapeCell(title.toUpperCase())].join(','))
  if (subtitle) {
    lines.push([escapeCell('Subtítulo / Alcance:'), escapeCell(subtitle)].join(','))
  }
  lines.push([
    escapeCell(`Fecha de Generación: ${dateStr} ${timeStr}`),
    escapeCell(`Generado por: ${generatedBy || 'Operador Autorizado'}`)
  ].join(','))

  // 2. Resumen Ejecutivo de Métricas
  if (summaryStats.length > 0) {
    lines.push('')
    lines.push([escapeCell('--- RESUMEN EJECUTIVO DEL PERÍODO ---'), escapeCell('')].join(','))
    summaryStats.forEach(stat => {
      lines.push([escapeCell(stat.label), escapeCell(String(stat.value))].join(','))
    })
  }

  lines.push('') // Separador de tabla

  // 3. Encabezados de Columnas
  lines.push(headers.map(escapeCell).join(','))

  // 4. Filas de Datos
  rows.forEach(row => {
    lines.push(row.map(escapeCell).join(','))
  })

  // 5. Totales al Pie
  if (footerTotals && footerTotals.length > 0) {
    lines.push('')
    lines.push(footerTotals.map(escapeCell).join(','))
  }

  // 6. Pie de Garantía de Auditoría
  lines.push('')
  lines.push([escapeCell('Garantía de Auditoría: Registro inmutable generado por el sistema de gestión POS.'), escapeCell('')].join(','))

  const csvContent = lines.join('\r\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
