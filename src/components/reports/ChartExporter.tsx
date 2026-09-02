'use client'

import { useCallback, useState } from 'react'
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
  Table,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { CreditReport } from '@/lib/reports/credit-report'
import {
  renderAreaChartCanvas,
  renderBarChartCanvas,
  renderDonutChartCanvas
} from '@/lib/reports/canvas-chart-renderer'

// ── Helpers de formato monetario y fechas ─────────────────────────────────────
const formatGs = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 Gs.'
  return `${Math.round(amount).toLocaleString('es-PY')} Gs.`
}

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return Math.round(num).toLocaleString('es-PY')
}

const formatDateStr = (dateStr: string): string => {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
  } catch {
    // fallback
  }
  return dateStr
}

const getDayOfWeekStr = (dateStr: string): string => {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      return days[d.getDay()] || ''
    }
  } catch {
    // fallback
  }
  return ''
}

// ── Helpers de estilos Excel (XLSXStyle) ──────────────────────────────────────
const XL_C = {
  navy:    '0F172A',
  navyL:   'F1F5F9',
  violet:  '6366F1',
  violetL: 'EEF2FF',
  blue:    '2563EB',
  blueL:   'EFF6FF',
  green:   '059669',
  greenL:  'ECFDF5',
  red:     'DC2626',
  redL:    'FEF2F2',
  amber:   'D97706',
  amberL:  'FFFBEB',
  gray:    '334155',
  grayL:   'F8FAFC',
  white:   'FFFFFF',
  border:  'CBD5E1',
}

type XCellStyle = {
  font?: { bold?: boolean; sz?: number; color?: { rgb: string }; name?: string; italic?: boolean }
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

const xlData = (rowIdx: number, align = 'left', isBold = false): XCellStyle => ({
  font:      { bold: isBold, sz: 10, color: { rgb: XL_C.gray }, name: 'Calibri' },
  fill:      { fgColor: { rgb: rowIdx % 2 === 0 ? XL_C.white : XL_C.grayL } },
  border:    XL_BORDER,
  alignment: { horizontal: align, vertical: 'center' },
})

const xlNum = (rowIdx: number, isBold = false): XCellStyle => xlData(rowIdx, 'right', isBold)

const xlTotal = (bgRgb = XL_C.navy): XCellStyle => ({
  font:      { bold: true, sz: 10, color: { rgb: XL_C.white }, name: 'Calibri' },
  fill:      { fgColor: { rgb: bgRgb } },
  border:    XL_BORDER,
  alignment: { horizontal: 'right', vertical: 'center' },
})

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
  creditReport?: CreditReport | null
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
  creditReport,
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

  // Función para capturar un gráfico como imagen limpia
  const captureChart = useCallback(async (chartRef: React.RefObject<HTMLDivElement | null>, chartTitle: string) => {
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
        title: chartTitle,
        dataURL: canvas.toDataURL(`image/${options.chartFormat}`, 0.95),
        width: canvas.width,
        height: canvas.height
      }
    } catch (error) {
      console.error(`Error capturando gráfico ${chartTitle}:`, error)
      return null
    } finally {
      safeCapture.cleanup()
    }
  }, [options.chartQuality, options.chartFormat, buildSafeCaptureNode, sanitizeUnsupportedColorFunctions])

  // ── EXPORTACIÓN DE PDF CON DISEÑO EJECUTIVO Y DETALLE COMPLETO ──────────────
  const exportPDFWithCharts = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(5)

    try {
      const isLandscape = options.pageLayout === 'landscape'
      const doc = new jsPDF({
        orientation: options.pageLayout,
        unit: 'pt',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 32
      const contentWidth = pageWidth - (margin * 2)
      const now = new Date()
      const dateLabel = now.toLocaleString('es-PY', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })

      // Datasets reales recibidos de la vista
      const salesDataset = chartData?.[0] ?? data ?? []
      const repairsTrendDataset = chartData?.[1] ?? []
      const repairsStatusDataset = chartData?.[2] ?? []
      const productsDataset = chartData?.[3] ?? []
      const selectedProductDataset = chartData?.[4] ?? []
      const categoriesDataset = chartData?.[5] ?? []

      // Cálculos globales de resumen del período
      const totalSalesSum = salesDataset.reduce((sum: number, r: any) => sum + (Number(r.sales) || 0), 0)
      const totalOrdersSum = salesDataset.reduce((sum: number, r: any) => sum + (Number(r.orders) || 0), 0)
      const totalProfitSum = salesDataset.reduce((sum: number, r: any) => sum + (Number(r.profit) || 0), 0)
      const totalCustomersSum = salesDataset.reduce((sum: number, r: any) => sum + (Number(r.customers) || 0), 0)
      const avgTicketGlobal = totalOrdersSum > 0 ? totalSalesSum / totalOrdersSum : 0
      const profitMarginPct = totalSalesSum > 0 ? ((totalProfitSum / totalSalesSum) * 100).toFixed(1) : '0'

      // Día pico de ventas
      let peakDay = { date: '', sales: 0, orders: 0 }
      let activeDaysCount = 0
      salesDataset.forEach((r: any) => {
        const s = Number(r.sales) || 0
        if (s > 0) activeDaysCount++
        if (s > peakDay.sales) {
          peakDay = { date: r.date, sales: s, orders: Number(r.orders) || 0 }
        }
      })
      const avgDailySales = salesDataset.length > 0 ? totalSalesSum / salesDataset.length : 0

      // Top producto y top categoría
      const topProduct = productsDataset[0] || null
      const topCategory = categoriesDataset[0] || null

      // ── PÁGINA 1: PORTADA EJECUTIVA Y DASHBOARD DE KPIS ────────────────────
      // Banner de Cabecera Superior
      doc.setFillColor(15, 23, 42) // Slate 900
      doc.rect(margin, 24, contentWidth, 68, 'F')

      // Acento de color superior (barra bicolor esmeralda/azul)
      doc.setFillColor(37, 99, 235) // Blue 600
      doc.rect(margin, 24, contentWidth / 2, 4, 'F')
      doc.setFillColor(16, 185, 129) // Emerald 500
      doc.rect(margin + contentWidth / 2, 24, contentWidth / 2, 4, 'F')

      // Textos del Banner
      doc.setFontSize(17)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(title.toUpperCase(), margin + 16, 52)

      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184) // Slate 400
      doc.text('INFORME EJECUTIVO DETALLADO DE GESTIÓN, VENTAS Y RENDIMIENTO OPERACIONAL', margin + 16, 72)

      doc.setFontSize(8.5)
      doc.setTextColor(203, 213, 225)
      doc.text(`Fecha de Emisión: ${dateLabel}`, pageWidth - margin - 16, 52, { align: 'right' })
      doc.text('Sistema 4G • Documento Oficial y Confidencial', pageWidth - margin - 16, 72, { align: 'right' })

      // Cuadrícula de Tarjetas KPI Ejecutivas
      let currentY = 104
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text('INDICADORES PRINCIPALES DE RENDIMIENTO (KPIS)', margin, currentY)

      currentY += 12

      const metricEntries = Object.entries(metrics)
      if (metricEntries.length > 0) {
        const cardsPerRow = isLandscape ? 4 : 2
        const cardGap = 8
        const cardWidth = (contentWidth - ((cardsPerRow - 1) * cardGap)) / cardsPerRow
        const cardHeight = 48

        metricEntries.forEach(([key, val], idx) => {
          const row = Math.floor(idx / cardsPerRow)
          const col = idx % cardsPerRow
          const cardX = margin + col * (cardWidth + cardGap)
          const cardY = currentY + row * (cardHeight + cardGap)

          // Fondo de tarjeta
          doc.setFillColor(248, 250, 252)
          doc.setDrawColor(226, 232, 240)
          doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 5, 5, 'FD')

          // Barra lateral de acento de tarjeta
          const accentColors = [
            [16, 185, 129], // Emerald
            [37, 99, 235],  // Blue
            [124, 58, 237], // Violet
            [217, 119, 6],  // Amber
            [99, 102, 241], // Indigo
            [6, 182, 212]   // Cyan
          ]
          const color = accentColors[idx % accentColors.length]
          doc.setFillColor(color[0], color[1], color[2])
          doc.roundedRect(cardX, cardY, 3.5, cardHeight, 1.5, 1.5, 'F')

          // Título de la métrica
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(100, 116, 139)
          doc.text(key.toUpperCase(), cardX + 10, cardY + 16, { maxWidth: cardWidth - 16 })

          // Valor de la métrica
          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(15, 23, 42)
          doc.text(String(val), cardX + 10, cardY + 35, { maxWidth: cardWidth - 16 })
        })

        const totalRows = Math.ceil(metricEntries.length / cardsPerRow)
        currentY += totalRows * (cardHeight + cardGap) + 12
      }

      // ── Cuadro de Diagnóstico y Conclusiones del Período ───────────────────
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text('RESUMEN Y DIAGNÓSTICO EJECUTIVO DEL NEGOCIO', margin, currentY)
      currentY += 10

      const diagnosticRows = [
        [
          'Día Pico de Ventas',
          peakDay.date ? `${formatDateStr(peakDay.date)} (${getDayOfWeekStr(peakDay.date)})` : 'N/D',
          formatGs(peakDay.sales),
          `${peakDay.orders} órdenes registradas`,
        ],
        [
          'Promedio Diario de Ventas',
          'Ventas divididas por días evaluados',
          formatGs(avgDailySales),
          `${salesDataset.length} días en el rango`,
        ],
        [
          'Días con Ventas Activas',
          'Frecuencia comercial del período',
          `${activeDaysCount} de ${salesDataset.length} días`,
          salesDataset.length > 0 ? `${((activeDaysCount / salesDataset.length) * 100).toFixed(0)}% de actividad` : '—',
        ],
        ...(topProduct ? [[
          'Producto Estrella (#1)',
          topProduct.name,
          formatGs(topProduct.sales),
          `${topProduct.quantity || 0} unid. (${topProduct.share ? topProduct.share.toFixed(1) : '—'}% part.)`,
        ]] : []),
        ...(topCategory ? [[
          'Categoría Predominante',
          topCategory.name,
          formatGs(topCategory.sales),
          `${topCategory.quantity || 0} unidades vendidas`,
        ]] : []),
        ...(totalProfitSum > 0 ? [[
          'Rentabilidad Bruta Estimada',
          `Margen comercial sobre ventas: ${profitMarginPct}%`,
          formatGs(totalProfitSum),
          'Ganancia bruta histórica',
        ]] : []),
      ]

      autoTable(doc, {
        startY: currentY,
        head: [['Indicador de Negocio', 'Detalle / Concepto', 'Valor Registrado', 'Observación']],
        body: diagnosticRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, cellPadding: 5, font: 'helvetica' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 160 },
          1: { fontStyle: 'normal' },
          2: { fontStyle: 'bold', halign: 'right', cellWidth: 120 },
          3: { fontStyle: 'normal', cellWidth: 140 }
        }
      })

      currentY = (doc as any).lastAutoTable.finalY + 14

      // Tabla de Contenido del Informe
      if (currentY + 80 < pageHeight) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('CONTENIDO Y MÓDULOS DEL INFORME', margin, currentY)
        currentY += 8

        const indexItems = [
          ['1', 'Evolución y Análisis Cronológico de Ventas', 'Facturación día por día, órdenes, ticket medio, clientes y margen.'],
          ['2', 'Ranking Detallado de Productos Más Vendidos', 'Top productos con unidades, precio unitario promedio, recaudación y participación.'],
          ['3', 'Participación y Desglose por Categorías', 'Distribución de ingresos por rubros comerciales con volúmenes de venta.'],
          ...(repairsTrendDataset.length > 0 || repairsStatusDataset.length > 0 ? [['4', 'Taller Técnico y Reparaciones', 'Estado de equipos, tasa de finalización técnica y evolución de ingresos de taller.']] : []),
        ]

        autoTable(doc, {
          startY: currentY,
          head: [['#', 'Módulo del Informe', 'Alcance y Detalle de los Datos']],
          body: indexItems,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 4.5, font: 'helvetica' },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 180, fontStyle: 'bold' },
            2: { fontStyle: 'normal' }
          }
        })
      }

      setExportProgress(25)

      // ── PÁGINAS DE GRÁFICOS CON TABLAS DE DATOS REALES FORMATEADAS ──────────
      for (let i = 0; i < chartRefs.length; i++) {
        setExportProgress(25 + Math.round((i / chartRefs.length) * 65))

        const chartTitle = chartTitles[i] || `Gráfico ${i + 1}`

        let chartDataUrl: string | null = null
        if (i === 0 && salesDataset.length > 0) {
          chartDataUrl = renderAreaChartCanvas(chartTitle, salesDataset.map((d: any) => ({ label: formatDateStr(d.date), value: Number(d.sales) || 0 })), { lineColor: '#2563eb', fillColor: '#3b82f6', formatValue: formatGs })
        } else if (i === 1 && repairsTrendDataset.length > 0) {
          chartDataUrl = renderAreaChartCanvas(chartTitle, repairsTrendDataset.map((d: any) => ({ label: formatDateStr(d.date), value: Number(d.count) || 0 })), { lineColor: '#dc2626', fillColor: '#ef4444', formatValue: (v) => `${v} orden${v === 1 ? '' : 'es'}` })
        } else if (i === 2 && repairsStatusDataset.length > 0) {
          chartDataUrl = renderDonutChartCanvas(chartTitle, repairsStatusDataset.map((d: any) => ({ label: d.name, value: Number(d.value) || 0, color: d.color })), { formatValue: (v) => `${v} equipos` })
        } else if (i === 3 && productsDataset.length > 0) {
          chartDataUrl = renderBarChartCanvas(chartTitle, productsDataset.slice(0, 10).map((d: any) => ({ label: d.name || 'Sin nombre', value: Number(d.sales) || 0 })), { barColor: '#059669', formatValue: formatGs })
        } else if (i === 4 && selectedProductDataset.length > 0) {
          chartDataUrl = renderAreaChartCanvas(chartTitle, selectedProductDataset.map((d: any) => ({ label: formatDateStr(d.date), value: Number(d.sales) || 0 })), { lineColor: '#2563eb', fillColor: '#3b82f6', formatValue: formatGs })
        } else if (i === 5 && categoriesDataset.length > 0) {
          chartDataUrl = renderDonutChartCanvas(chartTitle, categoriesDataset.slice(0, 8).map((d: any) => ({ label: d.name || 'Sin categoría', value: Number(d.sales) || 0 })), { formatValue: formatGs })
        }

        // Si no hay datos específicos para la página, omitir para no generar hoja vacía
        const hasDataForChart = (i === 0 && salesDataset.length > 0) ||
          (i === 1 && repairsTrendDataset.length > 0) ||
          (i === 2 && repairsStatusDataset.length > 0) ||
          (i === 3 && productsDataset.length > 0) ||
          (i === 4 && selectedProductDataset.length > 0) ||
          (i === 5 && categoriesDataset.length > 0)

        if (!hasDataForChart && !chartDataUrl) {
          continue
        }

        doc.addPage()

        // Encabezado de Sección
        doc.setFillColor(241, 245, 249)
        doc.roundedRect(margin, 28, contentWidth, 30, 5, 5, 'F')
        
        doc.setFillColor(37, 99, 235)
        doc.rect(margin, 28, 4, 30, 'F')

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text(`${i + 1}. ${chartTitle.toUpperCase()}`, margin + 12, 47)

        let yPos = 66

        // Insertar imagen del gráfico renderizado
        if (chartDataUrl) {
          doc.addImage(chartDataUrl, 'PNG', margin, yPos, contentWidth, 160)
          yPos += 172
        }

        // ── GENERAR TABLA DE DATOS DETALLADOS SEGÚN LA SECCIÓN ───────────────
        if (options.includeData) {
          if (i === 0 && salesDataset.length > 0) {
            // Sección 1: Ventas Diarias Detalladas
            const headers = ['Fecha', 'Día', 'Facturación (Gs.)', 'Órdenes', 'Ticket Prom. (Gs.)', 'Ganancia (Gs.)', 'Margen %', 'Part. %']

            const rows = salesDataset.slice(0, 31).map((row: any) => {
              const rowSales = Number(row.sales) || 0
              const rowOrders = Number(row.orders) || 0
              const rowTicket = rowOrders > 0 ? rowSales / rowOrders : rowSales
              const rowProfit = Number(row.profit) || 0
              const rowMargin = rowSales > 0 ? ((rowProfit / rowSales) * 100).toFixed(1) : '0'
              const rowShare = totalSalesSum > 0 ? ((rowSales / totalSalesSum) * 100).toFixed(1) : '0'

              return [
                formatDateStr(row.date),
                getDayOfWeekStr(row.date),
                formatGs(rowSales),
                formatNumber(rowOrders),
                formatGs(rowTicket),
                rowProfit > 0 ? formatGs(rowProfit) : '—',
                rowProfit > 0 ? `${rowMargin}%` : '—',
                `${rowShare}%`
              ]
            })

            const footRows = [[
              'TOTALES DEL PERÍODO',
              `${salesDataset.length} días`,
              formatGs(totalSalesSum),
              formatNumber(totalOrdersSum),
              formatGs(avgTicketGlobal),
              totalProfitSum > 0 ? formatGs(totalProfitSum) : '—',
              totalProfitSum > 0 ? `${profitMarginPct}%` : '—',
              '100%'
            ]]

            autoTable(doc, {
              startY: yPos,
              head: [headers],
              body: rows,
              foot: footRows,
              margin: { left: margin, right: margin },
              styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
              headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
              footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [248, 250, 252] },
              columnStyles: {
                0: { fontStyle: 'bold', halign: 'center', cellWidth: 65 },
                1: { halign: 'center', cellWidth: 35 },
                2: { halign: 'right', fontStyle: 'bold' },
                3: { halign: 'center', cellWidth: 45 },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right', cellWidth: 48 },
                7: { halign: 'right', cellWidth: 42 }
              }
            })
          } else if (i === 1 && repairsTrendDataset.length > 0) {
            // Sección: Tendencia de Reparaciones
            const headers = ['Fecha', 'Día', 'Reparaciones Ingresadas', 'Participación sobre Ingresos %']
            const totalRepairsCount = repairsTrendDataset.reduce((sum: number, r: any) => sum + (Number(r.count) || 0), 0)

            const rows = repairsTrendDataset.slice(0, 31).map((row: any) => {
              const count = Number(row.count) || 0
              const pct = totalRepairsCount > 0 ? ((count / totalRepairsCount) * 100).toFixed(1) : '0'
              return [
                formatDateStr(row.date),
                getDayOfWeekStr(row.date),
                formatNumber(count),
                `${pct}%`
              ]
            })

            const footRows = [[
              'TOTALES TALLER',
              `${repairsTrendDataset.length} días`,
              formatNumber(totalRepairsCount),
              '100%'
            ]]

            autoTable(doc, {
              startY: yPos,
              head: [headers],
              body: rows,
              foot: footRows,
              margin: { left: margin, right: margin },
              styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
              headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
              footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [248, 250, 252] },
              columnStyles: {
                0: { fontStyle: 'bold', halign: 'center' },
                1: { halign: 'center' },
                2: { halign: 'right', fontStyle: 'bold' },
                3: { halign: 'right' }
              }
            })
          } else if (i === 2 && repairsStatusDataset.length > 0) {
            // Sección: Estados de Reparación
            const headers = ['Estado Operativo de la Orden', 'Equipos Registrados', 'Distribución %']
            const totalRepairs = repairsStatusDataset.reduce((sum: number, r: any) => sum + (Number(r.value) || 0), 0)

            const rows = repairsStatusDataset.map((row: any) => {
              const val = Number(row.value) || 0
              const pct = totalRepairs > 0 ? ((val / totalRepairs) * 100).toFixed(1) : '0'
              return [row.name, formatNumber(val), `${pct}%`]
            })

            const footRows = [['TOTAL ÓRDENES EN TALLER', formatNumber(totalRepairs), '100%']]

            autoTable(doc, {
              startY: yPos,
              head: [headers],
              body: rows,
              foot: footRows,
              margin: { left: margin, right: margin },
              styles: { fontSize: 8.5, cellPadding: 4, font: 'helvetica' },
              headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold' },
              footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [248, 250, 252] },
              columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'right', fontStyle: 'bold' },
                2: { halign: 'right' }
              }
            })
          } else if (i === 3 && productsDataset.length > 0) {
            // Sección: Ranking de Productos Detallado
            const headers = ['#', 'Producto', 'Categoría', 'Unid.', 'Precio Unit. Prom.', 'Facturación Total (Gs.)', 'Part. %', 'Ganancia (Gs.)', 'Margen %']
            const totalProductsSales = productsDataset.reduce((sum: number, p: any) => sum + (Number(p.sales) || 0), 0)
            const totalProductsQty = productsDataset.reduce((sum: number, p: any) => sum + (Number(p.quantity) || 0), 0)
            const totalProductsProfit = productsDataset.reduce((sum: number, p: any) => sum + (Number(p.profit) || 0), 0)
            const overallProdMargin = totalProductsSales > 0 ? ((totalProductsProfit / totalProductsSales) * 100).toFixed(1) : '0'

            const rows = productsDataset.slice(0, 20).map((prod: any, idx: number) => {
              const pSales = Number(prod.sales) || 0
              const pQty = Number(prod.quantity) || 0
              const pProfit = Number(prod.profit) || 0
              const avgUnit = pQty > 0 ? pSales / pQty : pSales
              const share = totalProductsSales > 0 ? ((pSales / totalProductsSales) * 100).toFixed(1) : (prod.share?.toFixed(1) || '0')
              const pMargin = pSales > 0 ? ((pProfit / pSales) * 100).toFixed(1) : '0'

              return [
                `#${idx + 1}`,
                prod.name,
                prod.category || 'General',
                formatNumber(pQty),
                formatGs(avgUnit),
                formatGs(pSales),
                `${share}%`,
                pProfit > 0 ? formatGs(pProfit) : '—',
                pProfit > 0 ? `${pMargin}%` : '—'
              ]
            })

            const footRows = [[
              '',
              'TOTALES TOP PRODUCTOS',
              '',
              formatNumber(totalProductsQty),
              '—',
              formatGs(totalProductsSales),
              '100%',
              totalProductsProfit > 0 ? formatGs(totalProductsProfit) : '—',
              totalProductsProfit > 0 ? `${overallProdMargin}%` : '—'
            ]]

            autoTable(doc, {
              startY: yPos,
              head: [headers],
              body: rows,
              foot: footRows,
              margin: { left: margin, right: margin },
              styles: { fontSize: 7.5, cellPadding: 3.5, font: 'helvetica' },
              headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
              footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [248, 250, 252] },
              columnStyles: {
                0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
                1: { fontStyle: 'bold' },
                2: { halign: 'center', cellWidth: 80 },
                3: { halign: 'center', cellWidth: 35 },
                4: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' },
                6: { halign: 'right', cellWidth: 38 },
                7: { halign: 'right' },
                8: { halign: 'right', cellWidth: 42 }
              }
            })
          } else if (i === 4 && selectedProductDataset.length > 0) {
            // Sección: Tendencia Individual de Producto
            const headers = ['Fecha', 'Día', 'Facturación (Gs.)', 'Unidades Vendidas', 'Ticket Promedio (Gs.)']
            const totalSales = selectedProductDataset.reduce((sum: number, p: any) => sum + (Number(p.sales) || 0), 0)
            const totalQty = selectedProductDataset.reduce((sum: number, p: any) => sum + (Number(p.qty) || 0), 0)
            const avgTicket = totalQty > 0 ? totalSales / totalQty : totalSales

            const rows = selectedProductDataset.slice(0, 25).map((p: any) => [
              formatDateStr(p.date),
              getDayOfWeekStr(p.date),
              formatGs(p.sales),
              formatNumber(p.qty),
              formatGs(p.qty > 0 ? (p.sales || 0) / p.qty : p.sales)
            ])
            const footRows = [['TOTALES DEL ARTÍCULO', '', formatGs(totalSales), formatNumber(totalQty), formatGs(avgTicket)]]

            autoTable(doc, {
              startY: yPos,
              head: [headers],
              body: rows,
              foot: footRows,
              margin: { left: margin, right: margin },
              styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
              headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
              footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [248, 250, 252] },
              columnStyles: {
                0: { halign: 'center', fontStyle: 'bold' },
                1: { halign: 'center' },
                2: { halign: 'right', fontStyle: 'bold' },
                3: { halign: 'center' },
                4: { halign: 'right' }
              }
            })
          } else if (i === 5 && categoriesDataset.length > 0) {
            // Sección: Categorías Detalladas
            const headers = ['Categoría Comercial', 'Unidades Vendidas', 'Ventas Totales (Gs.)', 'Ticket Prom. / Unid.', 'Participación %']
            const totalCatSales = categoriesDataset.reduce((sum: number, c: any) => sum + (Number(c.sales) || 0), 0)
            const totalCatQty = categoriesDataset.reduce((sum: number, c: any) => sum + (Number(c.quantity) || 0), 0)

            const rows = categoriesDataset.map((cat: any) => {
              const cSales = Number(cat.sales) || 0
              const cQty = Number(cat.quantity) || 0
              const avgPerUnit = cQty > 0 ? cSales / cQty : cSales
              const share = totalCatSales > 0 ? ((cSales / totalCatSales) * 100).toFixed(1) : '0'
              return [cat.name, formatNumber(cQty), formatGs(cSales), formatGs(avgPerUnit), `${share}%`]
            })

            const footRows = [['TOTAL CATEGORÍAS', formatNumber(totalCatQty), formatGs(totalCatSales), '—', '100%']]

            autoTable(doc, {
              startY: yPos,
              head: [headers],
              body: rows,
              foot: footRows,
              margin: { left: margin, right: margin },
              styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
              headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
              footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [248, 250, 252] },
              columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'center' },
                2: { halign: 'right', fontStyle: 'bold' },
                3: { halign: 'right' },
                4: { halign: 'right' }
              }
            })
          }
        }
      }

      // ── PÁGINA ADICIONAL: CRÉDITOS Y COBRANZAS DE CARTERA ────────────────
      if (creditReport) {
        doc.addPage()
        doc.setFillColor(241, 245, 249)
        doc.roundedRect(margin, 28, contentWidth, 30, 5, 5, 'F')
        doc.setFillColor(15, 118, 110)
        doc.rect(margin, 28, 4, 30, 'F')

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('MÓDULO FINANCIERO: CRÉDITOS, CARTERA Y COBRANZAS', margin + 12, 47)

        let credY = 68

        const credKpis: Record<string, any> = {
          'Créditos Otorgados': formatNumber(creditReport.period.grantedCount),
          'Capital Financiado': formatGs(creditReport.period.principalGranted),
          'Cobranzas Recibidas': formatGs(creditReport.period.paymentsReceived),
          'Cartera Activa': formatGs(creditReport.portfolio.outstandingAmount),
          'Monto en Mora': formatGs(creditReport.portfolio.overdueAmount),
          'Tasa de Cobranza': `${creditReport.portfolio.collectionRate.toFixed(1)}%`,
          'Clientes en Mora': formatNumber(creditReport.portfolio.overdueCustomers),
          'Cuotas a Vencer': formatGs(creditReport.portfolio.dueSoonAmount),
        }

        const credKpiEntries = Object.entries(credKpis)
        const cCardsPerRow = isLandscape ? 4 : 2
        const cCardGap = 8
        const cCardWidth = (contentWidth - ((cCardsPerRow - 1) * cCardGap)) / cCardsPerRow
        const cCardHeight = 44

        credKpiEntries.forEach(([k, v], idx) => {
          const row = Math.floor(idx / cCardsPerRow)
          const col = idx % cCardsPerRow
          const cardX = margin + col * (cCardWidth + cCardGap)
          const cardY = credY + row * (cCardHeight + cCardGap)

          doc.setFillColor(248, 250, 252)
          doc.setDrawColor(226, 232, 240)
          doc.roundedRect(cardX, cardY, cCardWidth, cCardHeight, 4, 4, 'FD')

          doc.setFillColor(15, 118, 110)
          doc.roundedRect(cardX, cardY, 3, cCardHeight, 1.5, 1.5, 'F')

          doc.setFontSize(7.5)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(100, 116, 139)
          doc.text(k.toUpperCase(), cardX + 8, cardY + 14, { maxWidth: cCardWidth - 14 })

          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(15, 23, 42)
          doc.text(String(v), cardX + 8, cardY + 32, { maxWidth: cCardWidth - 14 })
        })

        credY += Math.ceil(credKpiEntries.length / cCardsPerRow) * (cCardHeight + cCardGap) + 14

        const statusLabels: Record<string, string> = { active: 'Al día', overdue: 'Con mora', completed: 'Cancelados' }
        const totalCredStatus = creditReport.statusDistribution.reduce((acc, s) => acc + s.count, 0)
        const credStatusRows = creditReport.statusDistribution.map((st) => {
          const pct = totalCredStatus > 0 ? ((st.count / totalCredStatus) * 100).toFixed(1) : '0'
          return [statusLabels[st.status] || st.status, formatNumber(st.count), `${pct}%`]
        })

        autoTable(doc, {
          startY: credY,
          head: [['Estado de Cuenta de Crédito', 'Cantidad de Créditos', 'Participación %']],
          body: credStatusRows,
          foot: [['TOTAL CUENTAS REGISTRADAS', formatNumber(totalCredStatus), '100%']],
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
          headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
          footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right', fontStyle: 'bold' },
            2: { halign: 'right' }
          }
        })

        credY = (doc as any).lastAutoTable.finalY + 14

        // Gráfico Canvas de Cobranzas
        if (creditReport.paymentTrend.length > 0) {
          const credChartImg = renderAreaChartCanvas(
            'Evolución Diaria de Cobranzas y Pagos Recibidos',
            creditReport.paymentTrend.map((p) => ({ label: formatDateStr(p.date), value: p.amount })),
            { lineColor: '#0f766e', fillColor: '#14b8a6', formatValue: formatGs }
          )
          if (credChartImg) {
            doc.addImage(credChartImg, 'PNG', margin, credY, contentWidth, 140)
            credY += 150
          }

          const totalPayments = creditReport.paymentTrend.reduce((acc, p) => acc + p.amount, 0)
          const payRows = creditReport.paymentTrend.slice(0, 20).map((p) => {
            const pct = totalPayments > 0 ? ((p.amount / totalPayments) * 100).toFixed(1) : '0'
            return [formatDateStr(p.date), getDayOfWeekStr(p.date), formatGs(p.amount), `${pct}%`]
          })

          autoTable(doc, {
            startY: credY,
            head: [['Fecha', 'Día', 'Monto Cobrado (Gs.)', 'Participación sobre Cobranzas %']],
            body: payRows,
            foot: [['TOTAL COBRANZAS DEL PERÍODO', `${creditReport.paymentTrend.length} días`, formatGs(totalPayments), '100%']],
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
            headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
            footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
              0: { fontStyle: 'bold', halign: 'center' },
              1: { halign: 'center' },
              2: { halign: 'right', fontStyle: 'bold' },
              3: { halign: 'right' }
            }
          })
        }
      }

      // ── ENCABEZADOS Y PIE DE PÁGINA EN TODAS LAS HOJAS ─────────────────────
      const totalPages = (doc.internal as any).getNumberOfPages()
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum)

        // Línea y encabezado superior (desde la página 2)
        if (pageNum > 1) {
          doc.setFontSize(7.5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(148, 163, 184)
          doc.text(title, margin, 20)
          doc.text('Sistema 4G • Reporte Ejecutivo de Gestión', pageWidth - margin, 20, { align: 'right' })
          
          doc.setDrawColor(226, 232, 240)
          doc.setLineWidth(0.5)
          doc.line(margin, 24, pageWidth - margin, 24)
        }

        // Línea y pie de página inferior
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.5)
        doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22)

        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text(`Generado el ${dateLabel} • Documento Confidencial`, margin, pageHeight - 10)
        doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
      }

      setExportProgress(95)

      // Guardar PDF
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
      const safeTitle = sanitizeFileName(title)
      doc.save(`${safeTitle}_informe_ejecutivo_${timestamp}.pdf`)

      setExportProgress(100)
      onExport?.('pdf-charts', true)
      toast.success('Informe PDF generado exitosamente con análisis y tablas detalladas.')

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

  // ── EXPORTACIÓN DE EXCEL CON FORMATO CORPORATIVO Y DATOS REALES ─────────────
  const exportExcelOnly = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(10)

    try {
      const wb = XLSXStyle.utils.book_new()
      const now = new Date()
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
      const safeTitle = sanitizeFileName(title)
      const dateLabel = now.toLocaleString('es-PY', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })

      // Datasets reales recibidos de la vista
      const salesDataset = chartData?.[0] ?? data ?? []
      const repairsTrendDataset = chartData?.[1] ?? []
      const repairsStatusDataset = chartData?.[2] ?? []
      const productsDataset = chartData?.[3] ?? []
      const selectedProductDataset = chartData?.[4] ?? []
      const categoriesDataset = chartData?.[5] ?? []

      // ── Hoja 1: Resumen Ejecutivo ──────────────────────────────────────────
      {
        const titleS: XCellStyle = { font: { bold: true, sz: 14, color: { rgb: XL_C.white }, name: 'Calibri' }, fill: { fgColor: { rgb: XL_C.navy } }, alignment: { horizontal: 'left', vertical: 'center' } }
        const subtitleS: XCellStyle = { font: { sz: 10, color: { rgb: XL_C.gray }, name: 'Calibri' }, fill: { fgColor: { rgb: XL_C.navyL } }, alignment: { horizontal: 'left', vertical: 'center' } }
        const labelS: XCellStyle = { font: { bold: true, sz: 10, color: { rgb: XL_C.gray }, name: 'Calibri' }, fill: { fgColor: { rgb: XL_C.white } }, border: XL_BORDER }
        const kpiHdr: XCellStyle = xlHdr(XL_C.blue)
        const diagHdr: XCellStyle = xlHdr(XL_C.green)
        const indexHdr: XCellStyle = xlHdr(XL_C.navy)
        const indexRow = (rowIdx: number): XCellStyle => ({ font: { sz: 10, color: { rgb: XL_C.gray }, name: 'Calibri' }, fill: { fgColor: { rgb: rowIdx % 2 === 0 ? XL_C.white : XL_C.blueL } }, border: XL_BORDER, alignment: { horizontal: 'left', vertical: 'center' } })

        const metricEntries = Object.entries(metrics)

        // Diagnóstico ejecutivo
        const totalSalesSum = salesDataset.reduce((sum: number, r: any) => sum + (Number(r.sales) || 0), 0)
        const peakDay = salesDataset.length > 0 ? [...salesDataset].sort((a: any, b: any) => (Number(b.sales) || 0) - (Number(a.sales) || 0))[0] : null
        const dailyAvg = salesDataset.length > 0 ? Math.round(totalSalesSum / salesDataset.length) : 0
        const activeDays = salesDataset.filter((r: any) => (Number(r.sales) || 0) > 0).length

        const rows: any[][] = [
          [xlCell(`📊  ${title.toUpperCase()}`, titleS), xlCell('', titleS), xlCell('', titleS)],
          [xlCell(`Sistema 4G • Informe Ejecutivo de Gestión y Ventas`, subtitleS), xlCell('', subtitleS), xlCell('', subtitleS)],
          [xlCell(`Fecha de Emisión: ${dateLabel} | Moneda Base: Guaraníes (PYG)`, subtitleS), xlCell('', subtitleS), xlCell('', subtitleS)],
          [xlCell('', {}), xlCell('', {}), xlCell('', {})],
          
          [xlCell('INDICADORES PRINCIPALES (KPIS)', kpiHdr), xlCell('', kpiHdr), xlCell('', kpiHdr)],
          [xlCell('Métrica de Gestión', labelS), xlCell('Valor Registrado', { ...labelS, alignment: { horizontal: 'right' } }), xlCell('Detalle / Unidad', labelS)],
          ...metricEntries.map(([k, v], i) => [
            xlCell(k, xlData(i, 'left', true)),
            xlCell(String(v), { ...xlNum(i, true), alignment: { horizontal: 'right' } }),
            xlCell(k.includes('Tasa') || k.includes('%') ? 'Porcentaje' : k.includes('Ventas') || k.includes('Margen') || k.includes('Ticket') || k.includes('Cartera') || k.includes('Cobranzas') ? 'Moneda (Gs.)' : 'Unidades', xlData(i)),
          ]),
          [xlCell('', {}), xlCell('', {}), xlCell('', {})],

          [xlCell('DIAGNÓSTICO Y RENDIMIENTO COMERCIAL', diagHdr), xlCell('', diagHdr), xlCell('', diagHdr)],
          [xlCell('Concepto Clave', labelS), xlCell('Resultado', { ...labelS, alignment: { horizontal: 'right' } }), xlCell('Observación', labelS)],
          [xlCell('Día Pico de Ventas', xlData(0, 'left', true)), xlCell(peakDay ? formatDateStr(peakDay.date) : '—', xlData(0, 'right', true)), xlCell(peakDay ? `${formatGs(peakDay.sales)} facturados` : '—', xlData(0))],
          [xlCell('Promedio Diario de Facturación', xlData(1, 'left', true)), xlCell(formatGs(dailyAvg), xlData(1, 'right', true)), xlCell('Por cada día del período', xlData(1))],
          [xlCell('Días con Venta Activa', xlData(2, 'left', true)), xlCell(`${activeDays} de ${salesDataset.length}`, xlData(2, 'right', true)), xlCell(salesDataset.length > 0 ? `${((activeDays / salesDataset.length) * 100).toFixed(0)}% de operatividad` : '—', xlData(2))],
          [xlCell('', {}), xlCell('', {}), xlCell('', {})],

          [xlCell('CONTENIDO Y HOJAS DEL LIBRO', indexHdr), xlCell('', indexHdr), xlCell('', indexHdr)],
          [xlCell('Hoja', labelS), xlCell('Descripción del Contenido', labelS), xlCell('Enfoque', labelS)],
          ...[
            ['Ventas Diarias',       'Evolución de facturación por día, órdenes, ticket promedio y ganancia.', 'Comercial'],
            ['Ranking Productos',    'Top de artículos vendidos, unidades, recaudación y % de participación.', 'Inventario'],
            ['Categorias',          'Desglose por rubros comerciales con participación de mercado.', 'Estratégico'],
            ...(repairsTrendDataset.length > 0 || repairsStatusDataset.length > 0 ? [['Taller Reparaciones', 'Estados de órdenes del taller técnico y tendencia de ingresos.', 'Operativo']] : []),
            ...(creditReport ? [['Creditos y Cobranzas', 'Salud de cartera, cobranzas del período, mora y financiamiento.', 'Financiero']] : []),
            ...(selectedProductDataset.length > 0 ? [['Tendencia Producto', 'Evolución individual del producto seleccionado.', 'Profundidad']] : []),
          ].map(([h, desc, enf], i) => [xlCell(h, indexRow(i)), xlCell(desc, indexRow(i)), xlCell(enf, indexRow(i))]),
        ]

        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 34 }, { wch: 28 }, { wch: 42 }]
        ws['!rows'] = [{ hpt: 26 }, { hpt: 16 }, { hpt: 16 }]
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Resumen Ejecutivo')
      }
      setExportProgress(30)

      // ── Hoja 2: Ventas Diarias ─────────────────────────────────────────────
      if (salesDataset && salesDataset.length > 0) {
        const hdr = xlHdr(XL_C.blue)
        const totalSalesSum = salesDataset.reduce((sum: number, r: any) => sum + (Number(r.sales) || 0), 0)
        const totalOrdersSum = salesDataset.reduce((sum: number, r: any) => sum + (Number(r.orders) || 0), 0)
        const totalProfitSum = salesDataset.reduce((sum: number, r: any) => sum + (Number(r.profit) || 0), 0)
        const avgTicket = totalOrdersSum > 0 ? totalSalesSum / totalOrdersSum : 0
        const totalMargin = totalSalesSum > 0 ? ((totalProfitSum / totalSalesSum) * 100).toFixed(1) : '0'

        const rows: any[][] = [
          [
            xlCell('Fecha', hdr),
            xlCell('Día', hdr),
            xlCell('Facturación Total (Gs.)', hdr),
            xlCell('Órdenes', hdr),
            xlCell('Ticket Promedio (Gs.)', hdr),
            xlCell('Ganancia Estimada (Gs.)', hdr),
            xlCell('Margen %', hdr),
            xlCell('Participación %', hdr),
            xlCell('Barra Visual', hdr),
          ],
          ...salesDataset.map((row: any, i: number) => {
            const s = Number(row.sales) || 0
            const o = Number(row.orders) || 0
            const p = Number(row.profit) || 0
            const t = o > 0 ? Math.round(s / o) : s
            const m = s > 0 ? +((p / s) * 100).toFixed(1) : 0
            const share = totalSalesSum > 0 ? +((s / totalSalesSum) * 100).toFixed(1) : 0
            const bars = '█'.repeat(Math.min(25, Math.max(1, Math.round(share / 4))))

            return [
              xlCell(formatDateStr(row.date), xlData(i, 'center')),
              xlCell(getDayOfWeekStr(row.date), xlData(i, 'center')),
              xlCell(s, xlNum(i, true)),
              xlCell(o, xlNum(i)),
              xlCell(t, xlNum(i)),
              xlCell(p > 0 ? p : '—', xlNum(i)),
              xlCell(p > 0 ? `${m}%` : '—', xlData(i, 'right')),
              xlCell(`${share}%`, xlData(i, 'right')),
              xlCell(bars, { ...xlData(i), font: { sz: 9, color: { rgb: XL_C.blue }, name: 'Calibri' } }),
            ]
          }),
          [
            xlCell('TOTALES DEL PERÍODO', xlTotal(XL_C.navy)),
            xlCell(`${salesDataset.length} días`, xlTotal(XL_C.navy)),
            xlCell(totalSalesSum, xlTotal(XL_C.navy)),
            xlCell(totalOrdersSum, xlTotal(XL_C.navy)),
            xlCell(Math.round(avgTicket), xlTotal(XL_C.navy)),
            xlCell(totalProfitSum > 0 ? totalProfitSum : '—', xlTotal(XL_C.navy)),
            xlCell(totalProfitSum > 0 ? `${totalMargin}%` : '—', xlTotal(XL_C.navy)),
            xlCell('100%', xlTotal(XL_C.navy)),
            xlCell('', xlTotal(XL_C.navy)),
          ]
        ]

        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 22 }]
        ws['!autofilter'] = { ref: `A1:I${salesDataset.length + 1}` }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Ventas Diarias')
      }
      setExportProgress(50)

      // ── Hoja 3: Ranking de Productos ───────────────────────────────────────
      if (productsDataset && productsDataset.length > 0) {
        const hdr = xlHdr(XL_C.green)
        const totalSalesSum = productsDataset.reduce((sum: number, p: any) => sum + (Number(p.sales) || 0), 0)
        const totalQtySum = productsDataset.reduce((sum: number, p: any) => sum + (Number(p.quantity) || 0), 0)
        const totalProfitSum = productsDataset.reduce((sum: number, p: any) => sum + (Number(p.profit) || 0), 0)

        const rows: any[][] = [
          [
            xlCell('Posición', hdr),
            xlCell('Producto', hdr),
            xlCell('Categoría Comercial', hdr),
            xlCell('Unidades Vendidas', hdr),
            xlCell('Precio Prom. Unitario (Gs.)', hdr),
            xlCell('Facturación Total (Gs.)', hdr),
            xlCell('Participación %', hdr),
            xlCell('Ganancia Est. (Gs.)', hdr),
            xlCell('Margen %', hdr),
            xlCell('Barra Visual', hdr),
          ],
          ...productsDataset.map((prod: any, i: number) => {
            const s = Number(prod.sales) || 0
            const q = Number(prod.quantity) || 0
            const p = Number(prod.profit) || 0
            const avgPrice = q > 0 ? Math.round(s / q) : s
            const share = totalSalesSum > 0 ? +((s / totalSalesSum) * 100).toFixed(1) : 0
            const m = s > 0 ? +((p / s) * 100).toFixed(1) : 0
            const bars = '█'.repeat(Math.min(25, Math.max(1, Math.round(share / 4))))
            const medal = i === 0 ? '🥇 #1' : i === 1 ? '🥈 #2' : i === 2 ? '🥉 #3' : `#${i + 1}`

            return [
              xlCell(medal, xlData(i, 'center', true)),
              xlCell(prod.name || 'Sin nombre', xlData(i, 'left', true)),
              xlCell(prod.category || 'General', xlData(i, 'left')),
              xlCell(q, xlNum(i)),
              xlCell(avgPrice, xlNum(i)),
              xlCell(s, xlNum(i, true)),
              xlCell(`${share}%`, xlData(i, 'right')),
              xlCell(p > 0 ? p : '—', xlNum(i)),
              xlCell(p > 0 ? `${m}%` : '—', xlData(i, 'right')),
              xlCell(bars, { ...xlData(i), font: { sz: 9, color: { rgb: XL_C.green }, name: 'Calibri' } }),
            ]
          }),
          [
            xlCell('TOTALES', xlTotal(XL_C.green)),
            xlCell('CATÁLOGO DE PRODUCTOS', xlTotal(XL_C.green)),
            xlCell('', xlTotal(XL_C.green)),
            xlCell(totalQtySum, xlTotal(XL_C.green)),
            xlCell('—', xlTotal(XL_C.green)),
            xlCell(totalSalesSum, xlTotal(XL_C.green)),
            xlCell('100%', xlTotal(XL_C.green)),
            xlCell(totalProfitSum > 0 ? totalProfitSum : '—', xlTotal(XL_C.green)),
            xlCell(totalProfitSum > 0 && totalSalesSum > 0 ? `${((totalProfitSum / totalSalesSum) * 100).toFixed(1)}%` : '—', xlTotal(XL_C.green)),
            xlCell('', xlTotal(XL_C.green)),
          ]
        ]

        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 12 }, { wch: 38 }, { wch: 22 }, { wch: 18 }, { wch: 26 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 20 }]
        ws['!autofilter'] = { ref: `A1:J${productsDataset.length + 1}` }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Ranking Productos')
      }
      setExportProgress(70)

      // ── Hoja 4: Categorías y Rubros ────────────────────────────────────────
      if (categoriesDataset && categoriesDataset.length > 0) {
        const hdr = xlHdr(XL_C.violet)
        const totalSalesSum = categoriesDataset.reduce((sum: number, c: any) => sum + (Number(c.sales) || 0), 0)
        const totalQtySum = categoriesDataset.reduce((sum: number, c: any) => sum + (Number(c.quantity) || 0), 0)

        const rows: any[][] = [
          [
            xlCell('Categoría Comercial', hdr),
            xlCell('Unidades Vendidas', hdr),
            xlCell('Facturación Total (Gs.)', hdr),
            xlCell('Ticket Prom. / Unid. (Gs.)', hdr),
            xlCell('Participación %', hdr),
            xlCell('Barra Visual', hdr),
          ],
          ...categoriesDataset.map((cat: any, i: number) => {
            const s = Number(cat.sales) || 0
            const q = Number(cat.quantity) || 0
            const avgU = q > 0 ? Math.round(s / q) : s
            const share = totalSalesSum > 0 ? +((s / totalSalesSum) * 100).toFixed(1) : 0
            const bars = '█'.repeat(Math.min(25, Math.max(1, Math.round(share / 4))))

            return [
              xlCell(cat.name || 'Sin Categoría', xlData(i, 'left', true)),
              xlCell(q, xlNum(i)),
              xlCell(s, xlNum(i, true)),
              xlCell(avgU, xlNum(i)),
              xlCell(`${share}%`, xlData(i, 'right')),
              xlCell(bars, { ...xlData(i), font: { sz: 9, color: { rgb: XL_C.violet }, name: 'Calibri' } }),
            ]
          }),
          [
            xlCell('TOTAL GENERAL', xlTotal(XL_C.violet)),
            xlCell(totalQtySum, xlTotal(XL_C.violet)),
            xlCell(totalSalesSum, xlTotal(XL_C.violet)),
            xlCell('—', xlTotal(XL_C.violet)),
            xlCell('100%', xlTotal(XL_C.violet)),
            xlCell('', xlTotal(XL_C.violet)),
          ]
        ]

        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 24 }]
        ws['!autofilter'] = { ref: `A1:F${categoriesDataset.length + 1}` }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Categorias')
      }
      setExportProgress(85)

      // ── Hoja 5: Taller y Reparaciones (si existen datos) ────────────────────
      if (repairsStatusDataset.length > 0 || repairsTrendDataset.length > 0) {
        const hdr = xlHdr(XL_C.amber)
        const totalRepairs = repairsStatusDataset.reduce((sum: number, r: any) => sum + (Number(r.value) || 0), 0)
        const totalTrendCount = repairsTrendDataset.reduce((sum: number, t: any) => sum + (Number(t.count) || 0), 0)

        const rows: any[][] = [
          [xlCell('DESGLOSE DE REPARACIONES POR ESTADO', hdr), xlCell('', hdr), xlCell('', hdr), xlCell('', hdr)],
          [xlCell('Estado Operativo', hdr), xlCell('Equipos Registrados', hdr), xlCell('Participación %', hdr), xlCell('Barra Visual', hdr)],
          ...repairsStatusDataset.map((st: any, i: number) => {
            const v = Number(st.value) || 0
            const pct = totalRepairs > 0 ? +((v / totalRepairs) * 100).toFixed(1) : 0
            const bars = '█'.repeat(Math.min(25, Math.max(1, Math.round(pct / 4))))
            return [
              xlCell(st.name, xlData(i, 'left', true)),
              xlCell(v, xlNum(i)),
              xlCell(`${pct}%`, xlData(i, 'right')),
              xlCell(bars, { ...xlData(i), font: { sz: 9, color: { rgb: XL_C.amber }, name: 'Calibri' } }),
            ]
          }),
          [
            xlCell('TOTAL ÓRDENES', xlTotal(XL_C.amber)),
            xlCell(totalRepairs, xlTotal(XL_C.amber)),
            xlCell('100%', xlTotal(XL_C.amber)),
            xlCell('', xlTotal(XL_C.amber)),
          ],
          [xlCell('', {}), xlCell('', {}), xlCell('', {}), xlCell('', {})],
          [xlCell('INGRESOS DIARIOS AL TALLER', hdr), xlCell('', hdr), xlCell('', hdr), xlCell('', hdr)],
          [xlCell('Fecha', hdr), xlCell('Día', hdr), xlCell('Órdenes Ingresadas', hdr), xlCell('Participación %', hdr)],
          ...repairsTrendDataset.map((t: any, i: number) => {
            const cnt = Number(t.count) || 0
            const pct = totalTrendCount > 0 ? +((cnt / totalTrendCount) * 100).toFixed(1) : 0
            return [
              xlCell(formatDateStr(t.date), xlData(i, 'center')),
              xlCell(getDayOfWeekStr(t.date), xlData(i, 'center')),
              xlCell(cnt, xlNum(i, true)),
              xlCell(`${pct}%`, xlData(i, 'right')),
            ]
          }),
          [
            xlCell('TOTAL INGRESOS', xlTotal(XL_C.amber)),
            xlCell(`${repairsTrendDataset.length} días`, xlTotal(XL_C.amber)),
            xlCell(totalTrendCount, xlTotal(XL_C.amber)),
            xlCell('100%', xlTotal(XL_C.amber)),
          ]
        ]

        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 22 }]
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Taller Reparaciones')
      }

      // ── Hoja 6: Tendencia de Producto (si existe selección) ─────────────────
      if (selectedProductDataset.length > 0) {
        const hdr = xlHdr(XL_C.blue)
        const totalSales = selectedProductDataset.reduce((sum: number, p: any) => sum + (Number(p.sales) || 0), 0)
        const totalQty = selectedProductDataset.reduce((sum: number, p: any) => sum + (Number(p.qty) || 0), 0)

        const rows: any[][] = [
          [
            xlCell('Fecha', hdr),
            xlCell('Día', hdr),
            xlCell('Facturación (Gs.)', hdr),
            xlCell('Unidades Vendidas', hdr),
          ],
          ...selectedProductDataset.map((p: any, i: number) => [
            xlCell(formatDateStr(p.date), xlData(i, 'center')),
            xlCell(getDayOfWeekStr(p.date), xlData(i, 'center')),
            xlCell(Number(p.sales) || 0, xlNum(i, true)),
            xlCell(Number(p.qty) || 0, xlNum(i)),
          ]),
          [
            xlCell('TOTAL', xlTotal(XL_C.blue)),
            xlCell(`${selectedProductDataset.length} días`, xlTotal(XL_C.blue)),
            xlCell(totalSales, xlTotal(XL_C.blue)),
            xlCell(totalQty, xlTotal(XL_C.blue)),
          ]
        ]

        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 20 }]
        ws['!autofilter'] = { ref: `A1:D${selectedProductDataset.length + 1}` }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Tendencia Producto')
      }

      // ── Hoja 7: Créditos y Cobranzas (si existe reporte de créditos) ───────
      if (creditReport) {
        const hdr = xlHdr(XL_C.green)
        const totalStatus = creditReport.statusDistribution.reduce((acc, s) => acc + s.count, 0)
        const totalPayments = creditReport.paymentTrend.reduce((acc, p) => acc + p.amount, 0)

        const rows: any[][] = [
          [xlCell('RESUMEN FINANCIERO DE CARTERA Y CRÉDITOS', hdr), xlCell('', hdr), xlCell('', hdr), xlCell('', hdr)],
          [xlCell('Indicador de Créditos', hdr), xlCell('Monto / Valor', hdr), xlCell('Unidad', hdr), xlCell('Observación', hdr)],
          [xlCell('Créditos Otorgados en Período', xlData(0, 'left', true)), xlCell(creditReport.period.grantedCount, xlNum(0)), xlCell('Operaciones', xlData(0)), xlCell('Nuevas financiaciones', xlData(0))],
          [xlCell('Capital Total Financiado', xlData(1, 'left', true)), xlCell(creditReport.period.principalGranted, xlNum(1, true)), xlCell('Gs.', xlData(1)), xlCell('Monto original', xlData(1))],
          [xlCell('Cobranzas Recibidas en Período', xlData(2, 'left', true)), xlCell(creditReport.period.paymentsReceived, xlNum(2, true)), xlCell('Gs.', xlData(2)), xlCell('Ingresos por cuotas', xlData(2))],
          [xlCell('Cartera Activa por Cobrar', xlData(3, 'left', true)), xlCell(creditReport.portfolio.outstandingAmount, xlNum(3, true)), xlCell('Gs.', xlData(3)), xlCell('Saldo total vigente', xlData(3))],
          [xlCell('Monto en Mora', xlData(4, 'left', true)), xlCell(creditReport.portfolio.overdueAmount, xlNum(4, true)), xlCell('Gs.', xlData(4)), xlCell('Cuotas vencidas impagas', xlData(4))],
          [xlCell('Tasa de Cobranza', xlData(5, 'left', true)), xlCell(`${creditReport.portfolio.collectionRate.toFixed(1)}%`, xlData(5, 'right')), xlCell('Porcentaje', xlData(5)), xlCell('Tasa de recuperación', xlData(5))],
          [xlCell('Clientes con Mora', xlData(6, 'left', true)), xlCell(creditReport.portfolio.overdueCustomers, xlNum(6)), xlCell('Clientes', xlData(6)), xlCell('Deudores atrasados', xlData(6))],
          [xlCell('Cuotas por Vencer Pronto', xlData(7, 'left', true)), xlCell(creditReport.portfolio.dueSoonAmount, xlNum(7, true)), xlCell('Gs.', xlData(7)), xlCell('Vencimiento próximo', xlData(7))],
          [xlCell('', {}), xlCell('', {}), xlCell('', {}), xlCell('', {})],
          
          [xlCell('DISTRIBUCIÓN DE CUENTAS POR ESTADO', hdr), xlCell('', hdr), xlCell('', hdr), xlCell('', hdr)],
          [xlCell('Estado', hdr), xlCell('Cantidad de Cuentas', hdr), xlCell('Part. %', hdr), xlCell('Barra Visual', hdr)],
          ...creditReport.statusDistribution.map((st, i) => {
            const pct = totalStatus > 0 ? +((st.count / totalStatus) * 100).toFixed(1) : 0
            const label = st.status === 'active' ? 'Al día' : st.status === 'overdue' ? 'Con mora' : 'Cancelados'
            const bars = '█'.repeat(Math.min(25, Math.max(1, Math.round(pct / 4))))
            return [
              xlCell(label, xlData(i, 'left', true)),
              xlCell(st.count, xlNum(i)),
              xlCell(`${pct}%`, xlData(i, 'right')),
              xlCell(bars, { ...xlData(i), font: { sz: 9, color: { rgb: XL_C.green }, name: 'Calibri' } }),
            ]
          }),
          [
            xlCell('TOTAL CUENTAS', xlTotal(XL_C.green)),
            xlCell(totalStatus, xlTotal(XL_C.green)),
            xlCell('100%', xlTotal(XL_C.green)),
            xlCell('', xlTotal(XL_C.green)),
          ],
          [xlCell('', {}), xlCell('', {}), xlCell('', {}), xlCell('', {})],
          
          [xlCell('COBRANZAS DIARIAS RECIBIDAS', hdr), xlCell('', hdr), xlCell('', hdr), xlCell('', hdr)],
          [xlCell('Fecha', hdr), xlCell('Día', hdr), xlCell('Cobranzas (Gs.)', hdr), xlCell('Participación %', hdr)],
          ...creditReport.paymentTrend.map((p, i) => {
            const pct = totalPayments > 0 ? +((p.amount / totalPayments) * 100).toFixed(1) : 0
            return [
              xlCell(formatDateStr(p.date), xlData(i, 'center')),
              xlCell(getDayOfWeekStr(p.date), xlData(i, 'center')),
              xlCell(p.amount, xlNum(i, true)),
              xlCell(`${pct}%`, xlData(i, 'right')),
            ]
          }),
          [
            xlCell('TOTAL COBRADO', xlTotal(XL_C.green)),
            xlCell(`${creditReport.paymentTrend.length} días`, xlTotal(XL_C.green)),
            xlCell(totalPayments, xlTotal(XL_C.green)),
            xlCell('100%', xlTotal(XL_C.green)),
          ],
        ]

        const ws = XLSXStyle.utils.aoa_to_sheet(rows)
        ws['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 22 }, { wch: 28 }]
        XLSXStyle.utils.book_append_sheet(wb, ws, 'Creditos y Cobranzas')
      }

      setExportProgress(95)

      // Descargar archivo Excel
      XLSXStyle.writeFile(wb, `${safeTitle}_analytics_${timestamp}.xlsx`)
      setExportProgress(100)
      onExport?.('excel', true)

      const sheetCount = wb.SheetNames.length
      toast.success(`Libro Excel descargado exitosamente (${sheetCount} hojas con datos reales y estilos).`)
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
      {/* ── Botón Descargar PDF con Menú de Opciones ── */}
      <div className="flex items-center rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 overflow-hidden shadow-2xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={exportPDFWithCharts}
          disabled={isExporting}
          className="gap-2 h-9 px-3 rounded-none text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-100/80 dark:hover:bg-rose-900/40 cursor-pointer"
        >
          {isExporting ? (
            <RefreshCw className="h-4 w-4 animate-spin text-rose-600" />
          ) : (
            <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          )}
          <span>Descargar PDF</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isExporting}
              className="h-9 w-7 px-0 rounded-none border-l border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100/80 dark:hover:bg-rose-900/40"
              title="Orientación del PDF"
            >
              <Layout className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 shadow-lg rounded-xl" align="end">
            <p className="text-xs font-bold text-foreground mb-2">Orientación del PDF</p>
            <div className="flex gap-2">
              {(['landscape', 'portrait'] as const).map((layout) => (
                <button
                  key={layout}
                  type="button"
                  onClick={() => setOptions(prev => ({ ...prev, pageLayout: layout }))}
                  className={`flex-1 py-1.5 px-2 text-xs rounded-lg border font-semibold transition-all cursor-pointer ${
                    options.pageLayout === layout
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-muted text-muted-foreground border-border hover:border-rose-400'
                  }`}
                >
                  {layout === 'landscape' ? 'Horizontal' : 'Vertical'}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Botón Exportar Excel con Estilo ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={exportExcelOnly}
        disabled={isExporting}
        className="gap-2 h-9 px-3.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 shadow-2xs cursor-pointer"
      >
        {isExporting ? (
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
        ) : (
          <Table className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        )}
        <span>Exportar Excel</span>
      </Button>

      {/* Barra de progreso interactiva */}
      {isExporting && (
        <div className="flex items-center gap-2 pl-1">
          <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-muted-foreground tabular-nums">
            {Math.round(exportProgress)}%
          </span>
        </div>
      )}
    </div>
  )
}
