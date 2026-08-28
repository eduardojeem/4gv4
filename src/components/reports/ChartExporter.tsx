'use client'

import { useCallback, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import XLSXStyle from 'xlsx-js-style'
import { toast } from 'sonner'
import { 
  Download, 
  FileText, 
  RefreshCw,
  Layout,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// ── Helpers de estilos Excel (módulo-level, estáticos) ────────────────────────
const XS = XLSXStyle

const XL_C = {
  violet:  '7C3AED',
  violetL: 'EDE9FE',
  blue:    '1D4ED8',
  green:   '15803D',
  red:     'B91C1C',
  amber:   'B45309',
  indigo:  '3730A3',
  indigoL: 'E0E7FF',
  gray:    '374151',
  grayL:   'F9FAFB',
  white:   'FFFFFF',
  border:  'D1D5DB',
}

type XCellStyle = {
  font?: { bold?: boolean; sz?: number; color?: { rgb: string }; name?: string }
  fill?: { fgColor: { rgb: string } }
  border?: Record<string, { style: string; color: { rgb: string } }>
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean }
}

const XL_BORDER = {
  top:    { style: 'thin', color: { rgb: XL_C.border } },
  bottom: { style: 'thin', color: { rgb: XL_C.border } },
  left:   { style: 'thin', color: { rgb: XL_C.border } },
  right:  { style: 'thin', color: { rgb: XL_C.border } },
}

const xlCell = (v: string | number, s: XCellStyle, t?: string) => ({
  v, t: t ?? (typeof v === 'number' ? 'n' : 's'), s,
})

const xlHdr = (bgRgb: string): XCellStyle => ({
  font:      { bold: true, sz: 10, color: { rgb: XL_C.white }, name: 'Calibri' },
  fill:      { fgColor: { rgb: bgRgb } },
  border:    XL_BORDER,
  alignment: { horizontal: 'center', vertical: 'center' },
})

const xlData = (rowIdx: number, align = 'left'): XCellStyle => ({
  font:      { sz: 10, color: { rgb: XL_C.gray }, name: 'Calibri' },
  fill:      { fgColor: { rgb: rowIdx % 2 === 0 ? XL_C.white : XL_C.grayL } },
  border:    XL_BORDER,
  alignment: { horizontal: align },
})

const xlNum = (rowIdx: number): XCellStyle => xlData(rowIdx, 'right')

interface ChartExportOptions {
  includeCharts: boolean
  chartQuality: 'low' | 'medium' | 'high'
  chartFormat: 'png' | 'jpeg'
  includeData: boolean
  includeMetrics: boolean
  pageLayout: 'portrait' | 'landscape'
  pdfChartsPerPage: 1 | 2 | 4
  chartSize: 'small' | 'medium' | 'large'
}

interface ChartExporterProps {
  title: string
  data: any[]
  metrics?: Record<string, any>
  chartRefs: React.RefObject<HTMLDivElement | null>[]
  chartTitles: string[]
  chartData?: any[][]
  onExport?: (format: string, success: boolean) => void
  className?: string
}

export function ChartExporter({
  title,
  data,
  metrics = {},
  chartRefs,
  chartTitles,
  chartData,
  onExport,
  className = ''
}: ChartExporterProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [options, setOptions] = useState<ChartExportOptions>({
    includeCharts: true,
    chartQuality: 'high',
    chartFormat: 'png',
    includeData: true,
    includeMetrics: true,
    pageLayout: 'landscape',
    pdfChartsPerPage: 1,
    chartSize: 'medium'
  })

  const sanitizeFileName = useCallback((value: string) => {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 120) || 'reporte'
  }, [])

  const sanitizeUnsupportedColorFunctions = useCallback((raw: string) => {
    return raw
      .replace(/\b(?:oklch|oklab|lch|lab)\([^)]+\)/gi, 'rgb(120, 120, 120)')
      .replace(/\bcolor-mix\([^)]*\)/gi, 'rgb(120, 120, 120)')
  }, [])

  const buildSafeCaptureNode = useCallback((sourceRoot: HTMLElement) => {
    const cloneRoot = sourceRoot.cloneNode(true) as HTMLElement
    const sourceNodes = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll('*'))]
    const cloneNodes = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll('*'))]
    const total = Math.min(sourceNodes.length, cloneNodes.length)

    for (let i = 0; i < total; i++) {
      const sourceNode = sourceNodes[i]
      const cloneNode = cloneNodes[i]

      cloneNode.removeAttribute('class')

      if (cloneNode instanceof HTMLElement) {
        const computed = window.getComputedStyle(sourceNode)
        for (let j = 0; j < computed.length; j++) {
          const property = computed.item(j)
          const value = sanitizeUnsupportedColorFunctions(computed.getPropertyValue(property))
          if (value) cloneNode.style.setProperty(property, value)
        }
      }

      if (sourceNode instanceof HTMLCanvasElement && cloneNode instanceof HTMLCanvasElement) {
        const ctx = cloneNode.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, cloneNode.width, cloneNode.height)
          ctx.drawImage(sourceNode, 0, 0)
        }
      }
    }

    cloneRoot.style.width = `${sourceRoot.offsetWidth}px`
    cloneRoot.style.height = `${sourceRoot.offsetHeight}px`

    const wrapper = document.createElement('div')
    wrapper.style.position = 'fixed'
    wrapper.style.left = '-10000px'
    wrapper.style.top = '0'
    wrapper.style.background = '#ffffff'
    wrapper.style.zIndex = '-1'
    wrapper.style.pointerEvents = 'none'
    wrapper.appendChild(cloneRoot)
    document.body.appendChild(wrapper)

    return {
      target: cloneRoot,
      cleanup: () => wrapper.remove()
    }
  }, [sanitizeUnsupportedColorFunctions])

  // Función para capturar un gráfico como imagen
  const captureChart = useCallback(async (chartRef: React.RefObject<HTMLDivElement | null>, title: string) => {
    if (!chartRef.current) return null

    const safeCapture = buildSafeCaptureNode(chartRef.current)

    try {
      const exportId = `chart-export-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      safeCapture.target.setAttribute('data-export-id', exportId)

      const canvas = await html2canvas(safeCapture.target, {
        backgroundColor: '#ffffff',
        scale: options.chartQuality === 'high' ? 2.5 : options.chartQuality === 'medium' ? 2 : 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        onclone: (clonedDoc) => {
          // Evita que html2canvas procese CSS global con color functions no soportadas.
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove())
          clonedDoc.body.style.background = '#ffffff'

          const clonedTarget = clonedDoc.querySelector<HTMLElement>(`[data-export-id="${exportId}"]`)
          if (clonedTarget) {
            clonedTarget.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
              const inline = el.getAttribute('style') || ''
              const sanitized = sanitizeUnsupportedColorFunctions(inline)
              if (sanitized !== inline) el.setAttribute('style', sanitized)
            })
          }
        },
        width: chartRef.current.offsetWidth,
        height: chartRef.current.offsetHeight
      })

      return {
        canvas,
        title,
        dataURL: canvas.toDataURL(`image/${options.chartFormat}`, 0.95),
        width: canvas.width,
        height: canvas.height
      }
    } catch (error) {
      console.error(`Error capturando gráfico ${title}:`, error)
      return null
    } finally {
      safeCapture.cleanup()
    }
  }, [options.chartQuality, options.chartFormat, buildSafeCaptureNode])

  // Función para exportar como imagen individual
  const exportAsImage = useCallback(async (format: 'png' | 'jpeg') => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const safeTitle = sanitizeFileName(title)
      let downloaded = 0

      for (let i = 0; i < chartRefs.length; i++) {
        setExportProgress((i / chartRefs.length) * 100)

        const chartImage = await captureChart(chartRefs[i], chartTitles[i])
        if (chartImage) {
          // Crear enlace de descarga
          const link = document.createElement('a')
          link.download = `${safeTitle}_${sanitizeFileName(chartTitles[i])}_${timestamp}.${format}`
          link.href = chartImage.dataURL
          link.click()
          downloaded += 1
          // Los navegadores bloquean o descartan descargas automáticas muy
          // seguidas (varios .click() en el mismo tick) sin avisar — una
          // pausa chica entre cada una evita perder imágenes en silencio.
          if (i < chartRefs.length - 1) await new Promise((r) => setTimeout(r, 250))
        }
      }

      setExportProgress(100)
      onExport?.(format, downloaded > 0)

      if (downloaded === 0) {
        toast.error('No se pudo generar ninguna imagen. Probá de nuevo.')
      } else if (downloaded < chartRefs.length) {
        toast.warning(`Se descargaron ${downloaded} de ${chartRefs.length} gráficos. Algunos no se pudieron capturar.`)
      } else {
        toast.success(`${downloaded} imagen${downloaded === 1 ? '' : 'es'} descargada${downloaded === 1 ? '' : 's'}.`)
      }

    } catch (error) {
      console.error('Error exportando imágenes:', error)
      onExport?.(format, false)
      toast.error('No se pudieron exportar las imágenes.', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [chartRefs, chartTitles, title, captureChart, onExport, sanitizeFileName])

  // Función para exportar PDF con gráficos
  const exportPDFWithCharts = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const doc = new jsPDF({
        orientation: options.pageLayout,
        unit: 'pt',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 40
      const contentWidth = pageWidth - (margin * 2)
      const addFooter = () => {
        const pageNo = doc.getCurrentPageInfo().pageNumber
        doc.setFontSize(9)
        doc.setTextColor(120, 120, 120)
        doc.text(`Página ${pageNo}`, pageWidth - margin, pageHeight - 18, { align: 'right' })
      }

      // Página de portada
      doc.setFontSize(24)
      doc.setTextColor(31, 78, 121)
      doc.text(title, margin, 80, { maxWidth: contentWidth })

      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      doc.text(`Reporte generado: ${new Date().toLocaleDateString('es-ES')}`, margin, 110)
      doc.text(`Incluye ${chartRefs.length} gráficos y análisis detallado`, margin, 130)

      // Resumen ejecutivo si hay métricas
      if (options.includeMetrics && Object.keys(metrics).length > 0) {
        doc.setFontSize(16)
        doc.setTextColor(31, 78, 121)
        doc.text('RESUMEN EJECUTIVO', margin, 180)

        let yPos = 210
        Object.entries(metrics).forEach(([key, value]) => {
          doc.setFontSize(11)
          doc.setTextColor(0, 0, 0)
          doc.text(`${key}: ${value}`, margin, yPos)
          yPos += 20
        })
      }
      addFooter()

      // Índice de gráficos
      if (options.includeCharts && chartTitles.length > 0) {
        doc.addPage()
        doc.setFontSize(18)
        doc.setTextColor(31, 78, 121)
        doc.text('ÍNDICE DE GRÁFICOS', margin, 70)
        let y = 105
        chartTitles.forEach((chartTitle, idx) => {
          doc.setFontSize(11)
          doc.setTextColor(40, 40, 40)
          doc.text(`${idx + 1}. ${chartTitle}`, margin, y, { maxWidth: contentWidth })
          y += 20
          if (y > pageHeight - 50) {
            addFooter()
            doc.addPage()
            y = 70
          }
        })
        addFooter()
      }

      // Capturar y agregar gráficos
      let compactSlotCount = 0
      for (let i = 0; i < chartRefs.length; i++) {
        setExportProgress((i / chartRefs.length) * 80)

        const chartImage = await captureChart(chartRefs[i], chartTitles[i])
        if (chartImage) {
          if (options.pdfChartsPerPage > 1) {
            const perPage = options.pdfChartsPerPage
            const columns = perPage === 4 ? 2 : 1
            const rows = perPage === 4 ? 2 : 2
            const slotIndex = compactSlotCount % perPage
            if (slotIndex === 0) {
              doc.addPage()
            }

            const cellGapX = 12
            const cellGapY = 14
            const gridTop = 58
            const gridBottom = pageHeight - 34
            const usableHeight = gridBottom - gridTop
            const cellWidth = (contentWidth - ((columns - 1) * cellGapX)) / columns
            const cellHeight = (usableHeight - ((rows - 1) * cellGapY)) / rows
            const rowIndex = Math.floor(slotIndex / columns)
            const colIndex = slotIndex % columns

            const cellX = margin + (colIndex * (cellWidth + cellGapX))
            const cellY = gridTop + (rowIndex * (cellHeight + cellGapY))
            const titleY = cellY + 10
            const imageTopY = cellY + 18
            const maxWidth = cellWidth
            const maxHeight = cellHeight - 24

            let chartWidth = chartImage.width
            let chartHeight = chartImage.height

            if (chartWidth > maxWidth) {
              const scale = maxWidth / chartWidth
              chartWidth = maxWidth
              chartHeight = chartHeight * scale
            }

            if (chartHeight > maxHeight) {
              const scale = maxHeight / chartHeight
              chartHeight = maxHeight
              chartWidth = chartWidth * scale
            }

            const xPos = cellX + ((maxWidth - chartWidth) / 2)
            doc.setFontSize(perPage === 4 ? 10 : 12)
            doc.setTextColor(31, 78, 121)
            doc.text(`${i + 1}. ${chartTitles[i]}`, cellX, titleY, { maxWidth: maxWidth })
            doc.addImage(
              chartImage.dataURL,
              options.chartFormat.toUpperCase(),
              xPos,
              imageTopY,
              chartWidth,
              chartHeight
            )

            compactSlotCount += 1
            if (slotIndex === perPage - 1) addFooter()
          } else {
            // Nueva página para cada gráfico
            doc.addPage()

            // Título del gráfico
            doc.setFontSize(16)
            doc.setTextColor(31, 78, 121)
            doc.text(chartTitles[i], margin, 50, { maxWidth: contentWidth })

            // Calcular dimensiones del gráfico
            const maxWidth = pageWidth - (margin * 2)
            const maxHeight = pageHeight - 150 // Espacio para título y datos

            let chartWidth = chartImage.width
            let chartHeight = chartImage.height

            // Escalar si es necesario
            if (chartWidth > maxWidth) {
              const scale = maxWidth / chartWidth
              chartWidth = maxWidth
              chartHeight = chartHeight * scale
            }

            if (chartHeight > maxHeight) {
              const scale = maxHeight / chartHeight
              chartHeight = maxHeight
              chartWidth = chartWidth * scale
            }

            // Centrar el gráfico
            const xPos = (pageWidth - chartWidth) / 2
            const yPos = 80

            // Agregar imagen del gráfico
            doc.addImage(
              chartImage.dataURL,
              options.chartFormat.toUpperCase(),
              xPos,
              yPos,
              chartWidth,
              chartHeight
            )

            // Agregar descripción o datos si está habilitado
            if (options.includeData && (data.length > 0 || (chartData && chartData[i] && chartData[i].length > 0))) {
              const currentChartData = (chartData && chartData[i]) || data;
              const dataYPos = yPos + chartHeight + 30
              
              const ROWS_IN_PDF_TABLE = 20
              const isTruncated = currentChartData.length > ROWS_IN_PDF_TABLE
              doc.setFontSize(12)
              doc.setTextColor(31, 78, 121)
              doc.text(
                isTruncated
                  ? `Datos del gráfico (primeros ${ROWS_IN_PDF_TABLE} de ${currentChartData.length} registros):`
                  : 'Datos del gráfico:',
                margin,
                dataYPos
              )

              // Tabla con datos relevantes (hasta 6 columnas, filas acotadas para
              // que el PDF no crezca sin límite — se avisa arriba si se recorta).
              const headers = Object.keys(currentChartData[0] || {}).slice(0, 6)
              const tableData = currentChartData.slice(0, ROWS_IN_PDF_TABLE).map((item: any) =>
                headers.map((key) => String(item?.[key] ?? ''))
              )

              if (tableData.length > 0 && headers.length > 0) {
                autoTable(doc, {
                  startY: dataYPos + 20,
                  head: [headers],
                  body: tableData,
                  styles: { fontSize: 8, cellPadding: 3 },
                  headStyles: { fillColor: [54, 96, 146], textColor: [255, 255, 255] },
                  margin: { left: margin, right: margin },
                  tableWidth: 'auto'
                })
              }
            }
            addFooter()
          }
        }
      }
      if (options.pdfChartsPerPage > 1 && compactSlotCount % options.pdfChartsPerPage !== 0) addFooter()

      setExportProgress(90)

      // Guardar PDF
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const safeTitle = sanitizeFileName(title)
      doc.save(`${safeTitle}_con_graficos_${timestamp}.pdf`)

      setExportProgress(100)
      onExport?.('pdf-charts', true)
      toast.success('PDF generado y descargado.')

    } catch (error) {
      console.error('Error exportando PDF con gráficos:', error)
      toast.error('No se pudo generar el PDF.', {
        description: error instanceof Error ? error.message : undefined,
      })
      onExport?.('pdf-charts', false)
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [options, title, chartRefs, chartTitles, metrics, data, chartData, captureChart, onExport, sanitizeFileName])

  // Función para exportar Excel completo y detallado
  const exportExcelOnly = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const wb = XLSXStyle.utils.book_new()
      const now = new Date()
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
      const safeTitle = sanitizeFileName(title)
      const dateLabel = now.toLocaleString('es-PY', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })

      // ── Hoja 1: Resumen ───────────────────────────────────────────────────────
      {
        const titleS: XCellStyle  = { font: { bold: true, sz: 16, color: { rgb: XL_C.white }, name: 'Calibri' }, fill: { fgColor: { rgb: XL_C.violet } }, alignment: { horizontal: 'left', vertical: 'center' } }
        const subtitleS: XCellStyle = { font: { sz: 10, color: { rgb: XL_C.gray }, name: 'Calibri' }, fill: { fgColor: { rgb: XL_C.grayL } }, alignment: { horizontal: 'left' } }
        const labelS: XCellStyle = { font: { bold: true, sz: 10, color: { rgb: XL_C.gray }, name: 'Calibri' }, fill: { fgColor: { rgb: XL_C.white } }, border: XL_BORDER }
        const kpiHdr: XCellStyle = xlHdr(XL_C.violet)
        const indexHdr: XCellStyle = xlHdr(XL_C.gray)
        const indexRow = (rowIdx: number): XCellStyle => ({ font: { sz: 10, color: { rgb: XL_C.gray }, name: 'Calibri' }, fill: { fgColor: { rgb: rowIdx % 2 === 0 ? XL_C.white : XL_C.violetL } }, border: XL_BORDER, alignment: { horizontal: 'left' } })

        const metricEntries = Object.entries(metrics)

        const rows: any[][] = [
          [xlCell('📊  REPORTE DE ANALYTICS', titleS), xlCell('', titleS)],
          [xlCell(`Negocio: ${title}`, subtitleS), xlCell('', subtitleS)],
          [xlCell(`Generado el: ${dateLabel}`, subtitleS), xlCell('', subtitleS)],
          [xlCell('', {}), xlCell('', {})],
          [xlCell('INDICADORES CLAVE DEL PERIODO', kpiHdr), xlCell('', kpiHdr)],
          [xlCell('Métrica', labelS), xlCell('Valor', { ...labelS, alignment: { horizontal: 'right' } })],
          ...metricEntries.map(([k, v], i) => [
            xlCell(k, xlData(i)),
            xlCell(v, { ...xlNum(i), alignment: { horizontal: 'right' } }),
          ]),
          [xlCell('', {}), xlCell('', {})],
          [xlCell('CONTENIDO DEL ARCHIVO', indexHdr), xlCell('', indexHdr)],
          [xlCell('Hoja', { ...labelS }), xlCell('Descripción', labelS)],
          ...[
            ['KPIs',            'Indicadores clave del período seleccionado'],
            ['Ventas por Dia',  'Facturación diaria: POS, Taller y Total Bruto'],
            ['Ventas por Hora', 'Distribución de ingresos por franja horaria'],
            ['Finanzas',        'Ingresos, Egresos, Ganancia y Margen %'],
            ['Sucursales',      'Movimiento POS desglosado por sucursal'],
            ['Top Categorias',  'Categorías más vendidas con participación %'],
            ['Reparaciones',    'Estados de órdenes del taller'],
          ].map(([h, desc], i) => [xlCell(h, indexRow(i)), xlCell(desc, indexRow(i))]),
        ]
        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 40 }, { wch: 52 }]
        ws['!rows'] = [{ hpt: 28 }, { hpt: 16 }, { hpt: 16 }]
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Resumen')
      }
      setExportProgress(14)

      // ── Hoja 2: KPIs ─────────────────────────────────────────────────────────
      if (Object.keys(metrics).length > 0) {
        const hdr = xlHdr(XL_C.violet)
        const rows: any[][] = [
          [xlCell('Métrica', hdr), xlCell('Valor', hdr), xlCell('Notas', hdr)],
          ...Object.entries(metrics).map(([k, v], i) => [
            xlCell(k, xlData(i)),
            xlCell(v, xlNum(i)),
            xlCell('', xlData(i)),
          ]),
        ]
        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 42 }, { wch: 28 }, { wch: 40 }]
        ws['!autofilter'] = { ref: 'A1:C1' }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'KPIs')
      }
      setExportProgress(28)

      // ── Hoja 3: Ventas por Día ────────────────────────────────────────────────
      const salesTrend = chartData?.[0] ?? data
      if (salesTrend && salesTrend.length > 0) {
        const hdr = xlHdr(XL_C.blue)
        const rows: any[][] = [
          [xlCell('Fecha', hdr), xlCell('POS (Gs.)', hdr), xlCell('Taller (Gs.)', hdr), xlCell('Total Bruto (Gs.)', hdr), xlCell('Cant. Órdenes', hdr)],
          ...salesTrend.map((p: any, i: number) => {
            const pos = p.posRevenue ?? 0
            const rep = p.repairRevenue ?? 0
            const tot = p.grossRevenue ?? pos + rep
            return [
              xlCell(p.label ?? '', xlData(i)),
              xlCell(pos, xlNum(i)),
              xlCell(rep, xlNum(i)),
              xlCell(tot, { ...xlNum(i), font: { bold: true, sz: 10, color: { rgb: tot > 0 ? XL_C.blue : XL_C.red }, name: 'Calibri' } }),
              xlCell(p.orders ?? 0, xlNum(i)),
            ]
          }),
        ]
        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 16 }]
        ws['!autofilter'] = { ref: 'A1:E1' }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Ventas por Dia')
      }
      setExportProgress(42)

      // ── Hoja 4: Ventas por Hora ───────────────────────────────────────────────
      const hourlySales = chartData?.[1]
      if (hourlySales && hourlySales.length > 0) {
        const hdr = xlHdr(XL_C.indigo)
        const maxVal = Math.max(...hourlySales.map((p: any) => p.value ?? 0))
        const rows: any[][] = [
          [xlCell('Hora', hdr), xlCell('Ingresos (Gs.)', hdr), xlCell('Barra visual', hdr)],
          ...hourlySales.map((p: any, i: number) => {
            const val = p.value ?? 0
            const bars = maxVal > 0 ? '█'.repeat(Math.round((val / maxVal) * 20)) : ''
            return [
              xlCell(p.label ?? '', xlData(i, 'center')),
              xlCell(val, xlNum(i)),
              xlCell(bars, { ...xlData(i), font: { sz: 9, color: { rgb: XL_C.indigo }, name: 'Calibri' } }),
            ]
          }),
        ]
        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 30 }]
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Ventas por Hora')
      }
      setExportProgress(55)

      // ── Hoja 5: Finanzas ──────────────────────────────────────────────────────
      const financeComp = chartData?.[5]
      if (financeComp && financeComp.length > 0) {
        const hdr = xlHdr(XL_C.green)
        const rows: any[][] = [
          [xlCell('Periodo', hdr), xlCell('Ingresos (Gs.)', hdr), xlCell('Egresos (Gs.)', hdr), xlCell('Ganancia (Gs.)', hdr), xlCell('Margen (%)', hdr)],
          ...financeComp.map((p: any, i: number) => {
            const ingr = p.ingresos ?? 0
            const egr  = p.egresos  ?? 0
            const gan  = p.ganancia ?? 0
            const mrg  = ingr > 0 ? +((gan / ingr) * 100).toFixed(1) : 0
            const ganStyle: XCellStyle = {
              ...xlNum(i),
              font: { bold: true, sz: 10, color: { rgb: gan >= 0 ? XL_C.green : XL_C.red }, name: 'Calibri' },
            }
            return [
              xlCell(p.label ?? '', xlData(i)),
              xlCell(ingr, xlNum(i)),
              xlCell(egr,  { ...xlNum(i), font: { sz: 10, color: { rgb: XL_C.red }, name: 'Calibri' } }),
              xlCell(gan,  ganStyle),
              xlCell(mrg,  { ...xlNum(i), font: { sz: 10, color: { rgb: mrg >= 0 ? XL_C.green : XL_C.red }, name: 'Calibri' } }),
            ]
          }),
        ]
        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 14 }]
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Finanzas')
      }
      setExportProgress(66)

      // ── Hoja 6: Sucursales ────────────────────────────────────────────────────
      const byBranch = chartData?.[2]
      if (byBranch && byBranch.length > 0) {
        const hdr = xlHdr(XL_C.blue)
        const maxVal = Math.max(...byBranch.map((p: any) => p.value ?? 0))
        const rows: any[][] = [
          [xlCell('Sucursal', hdr), xlCell('Movimiento POS (Gs.)', hdr), xlCell('Part. %', hdr)],
          ...byBranch.map((p: any, i: number) => {
            const val = p.value ?? 0
            const pct = maxVal > 0 ? +((val / maxVal) * 100).toFixed(1) : 0
            return [
              xlCell(p.label ?? '', xlData(i)),
              xlCell(val, xlNum(i)),
              xlCell(pct, xlNum(i)),
            ]
          }),
        ]
        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 30 }, { wch: 26 }, { wch: 12 }]
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Sucursales')
      }
      setExportProgress(76)

      // ── Hoja 7: Top Categorías ────────────────────────────────────────────────
      const topCats = chartData?.[3]
      if (topCats && topCats.length > 0) {
        const hdr = xlHdr(XL_C.indigo)
        const total = topCats.reduce((acc: number, p: any) => acc + (p.value ?? 0), 0)
        const rows: any[][] = [
          [xlCell('Categoría', hdr), xlCell('Ventas (Gs.)', hdr), xlCell('Part. %', hdr), xlCell('Ranking', hdr)],
          ...topCats.map((p: any, i: number) => {
            const val = p.value ?? 0
            const pct = total > 0 ? +((val / total) * 100).toFixed(1) : 0
            const rankStyle: XCellStyle = {
              font: { bold: true, sz: 11, color: { rgb: i === 0 ? 'D97706' : i === 1 ? '6B7280' : i === 2 ? '92400E' : XL_C.gray }, name: 'Calibri' },
              fill: { fgColor: { rgb: i % 2 === 0 ? XL_C.white : XL_C.indigoL } },
              border: XL_BORDER,
              alignment: { horizontal: 'center' },
            }
            return [
              xlCell(p.label ?? '', xlData(i)),
              xlCell(val, xlNum(i)),
              xlCell(pct, xlNum(i)),
              xlCell(i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`, rankStyle, 's'),
            ]
          }),
        ]
        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 12 }, { wch: 10 }]
        ws['!autofilter'] = { ref: 'A1:D1' }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Top Categorias')
      }
      setExportProgress(86)

      // ── Hoja 8: Reparaciones ──────────────────────────────────────────────────
      const repairSt = chartData?.[4]
      if (repairSt && repairSt.length > 0) {
        const hdr = xlHdr(XL_C.amber)
        const total = repairSt.reduce((acc: number, p: any) => acc + (p.value ?? 0), 0)
        const totalS: XCellStyle = { font: { bold: true, sz: 10, color: { rgb: XL_C.white }, name: 'Calibri' }, fill: { fgColor: { rgb: XL_C.amber } }, border: XL_BORDER, alignment: { horizontal: 'right' } }
        const rows: any[][] = [
          [xlCell('Estado', hdr), xlCell('Cantidad', hdr), xlCell('Part. %', hdr)],
          ...repairSt.map((p: any, i: number) => {
            const val = p.value ?? 0
            const pct = total > 0 ? +((val / total) * 100).toFixed(1) : 0
            return [
              xlCell(p.label ?? '', xlData(i)),
              xlCell(val, xlNum(i)),
              xlCell(pct, xlNum(i)),
            ]
          }),
          [xlCell('', {}), xlCell('', {}), xlCell('', {})],
          [xlCell('TOTAL', totalS), xlCell(total, totalS), xlCell('100%', totalS)],
        ]
        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }]
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Reparaciones')
      }
      setExportProgress(95)

      XLSXStyle.writeFile(wb, `${safeTitle}_analytics_${timestamp}.xlsx`)
      setExportProgress(100)
      onExport?.('excel', true)

      const sheetCount = wb.SheetNames.length
      toast.success(`Excel descargado — ${sheetCount} hojas con colores y datos.`)
    } catch (error) {
      console.error('Error exportando Excel:', error)
      onExport?.('excel', false)
      toast.error('No se pudo generar el Excel.', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [title, data, metrics, chartData, onExport, sanitizeFileName])



  return (
    <div className={`flex items-center gap-2 ${className}`}>

      {/* ── PDF ── */}
      <div className="flex items-center rounded-xl border border-border overflow-hidden shadow-xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={exportPDFWithCharts}
          disabled={isExporting}
          className="gap-2 h-8 px-3 rounded-none text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
        >
          {isExporting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          Descargar PDF
        </Button>

        {/* Opción de orientación del PDF */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isExporting}
              className="h-8 w-7 px-0 rounded-none border-l border-border text-muted-foreground hover:bg-muted"
              title="Opciones de PDF"
            >
              <Layout className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="end">
            <p className="text-xs font-semibold text-foreground mb-2">Orientación del PDF</p>
            <div className="flex gap-2">
              {(['landscape', 'portrait'] as const).map((layout) => (
                <button
                  key={layout}
                  type="button"
                  onClick={() => setOptions(prev => ({ ...prev, pageLayout: layout }))}
                  className={`flex-1 py-1.5 px-2 text-xs rounded-lg border font-medium transition-colors ${
                    options.pageLayout === layout
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-muted text-muted-foreground border-border hover:border-rose-400'
                  }`}
                >
                  {layout === 'landscape' ? '⬛ Horizontal' : '▬ Vertical'}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Excel ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={exportExcelOnly}
        disabled={isExporting}
        className="gap-2 h-8 px-3 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-border hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300"
      >
        {isExporting ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Exportar Excel
      </Button>

      {/* Barra de progreso */}
      {isExporting && (
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300 rounded-full"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {Math.round(exportProgress)}%
          </span>
        </div>
      )}
    </div>
  )
}
