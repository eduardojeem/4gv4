'use client'

import { useCallback, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { motion  } from '../ui/motion'
import { 
  Download, 
  FileImage, 
  FileText, 
  BarChart3, 
  RefreshCw,
  Camera,
  Palette,
  Layout,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'

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
  const exportAsImage = useCallback(async (format: 'png' | 'jpeg' | 'svg') => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const safeTitle = sanitizeFileName(title)
      
      for (let i = 0; i < chartRefs.length; i++) {
        setExportProgress((i / chartRefs.length) * 100)
        
        const chartImage = await captureChart(chartRefs[i], chartTitles[i])
        if (chartImage) {
          // Crear enlace de descarga
          const link = document.createElement('a')
          link.download = `${safeTitle}_${sanitizeFileName(chartTitles[i])}_${timestamp}.${format}`
          link.href = chartImage.dataURL
          link.click()
        }
      }

      setExportProgress(100)
      onExport?.(format, true)
      
    } catch (error) {
      console.error('Error exportando imágenes:', error)
      onExport?.(format, false)
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
              
              doc.setFontSize(12)
              doc.setTextColor(31, 78, 121)
              doc.text('Datos del gráfico:', margin, dataYPos)

              // Agregar tabla con datos relevantes (primeros 8 registros y hasta 6 columnas)
              const headers = Object.keys(currentChartData[0] || {}).slice(0, 6)
              const tableData = currentChartData.slice(0, 8).map((item: any) =>
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

    } catch (error) {
      console.error('Error exportando PDF con gráficos:', error)
      onExport?.('pdf-charts', false)
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [options, title, chartRefs, chartTitles, metrics, data, chartData, captureChart, onExport, sanitizeFileName])

  // Función para exportar Excel con gráficos
  const exportExcelOnly = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const wb = XLSX.utils.book_new()
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const safeTitle = sanitizeFileName(title)

      const summaryRows = [
        ['Reporte', title],
        ['Generado', new Date().toLocaleString('es-ES')],
        ['', ''],
        ['Incluye datos', options.includeData ? 'Sí' : 'No'],
        ['Incluye métricas', options.includeMetrics ? 'Sí' : 'No']
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
      wsSummary['!cols'] = [{ wch: 28 }, { wch: 56 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')
      setExportProgress(20)

      if (options.includeData && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data)
        const headers = Object.keys(data[0] || {})
        ws['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + Math.max(headers.length, 1))}1` }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSX.utils.book_append_sheet(wb, ws, 'Datos')
      }
      setExportProgress(55)

      if (options.includeMetrics && Object.keys(metrics).length > 0) {
        const metricsData = Object.entries(metrics).map(([key, value]) => ({
          Métrica: key,
          Valor: value
        }))
        const wsMetrics = XLSX.utils.json_to_sheet(metricsData)
        wsMetrics['!cols'] = [{ wch: 40 }, { wch: 22 }]
        XLSX.utils.book_append_sheet(wb, wsMetrics, 'Métricas')
      }
      setExportProgress(85)

      XLSX.writeFile(wb, `${safeTitle}_excel_${timestamp}.xlsx`)
      setExportProgress(100)
      onExport?.('excel', true)
    } catch (error) {
      console.error('Error exportando Excel:', error)
      onExport?.('excel', false)
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [options.includeData, options.includeMetrics, title, data, metrics, onExport, sanitizeFileName])

  // Función para exportar Excel con gráficos (ZIP)
  const exportExcelWithCharts = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const wb = XLSX.utils.book_new()
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const safeTitle = sanitizeFileName(title)
      const zipEntries: Array<{ fileName: string; dataURL: string }> = []

      // Hoja de resumen
      const summaryRows = [
        ['Reporte', title],
        ['Generado', new Date().toLocaleString('es-ES')],
        ['Total de gráficos', String(chartRefs.length)],
        ['Formato de imágenes', options.chartFormat.toUpperCase()],
        ['', ''],
        ['Secciones incluidas', [
          options.includeData ? 'Datos' : null,
          options.includeMetrics ? 'Métricas' : null,
          options.includeCharts ? 'Gráficos' : null
        ].filter(Boolean).join(', ') || 'Ninguna']
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
      wsSummary['!cols'] = [{ wch: 28 }, { wch: 68 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

      // Hoja de datos
      if (options.includeData && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data)
        const headers = Object.keys(data[0] || {})
        ws['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + Math.max(headers.length, 1))}1` }
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        XLSX.utils.book_append_sheet(wb, ws, 'Datos')
      }

      // Hoja de métricas
      if (options.includeMetrics && Object.keys(metrics).length > 0) {
        const metricsData = Object.entries(metrics).map(([key, value]) => ({
          Métrica: key,
          Valor: value
        }))
        const wsMetrics = XLSX.utils.json_to_sheet(metricsData)
        wsMetrics['!cols'] = [{ wch: 40 }, { wch: 22 }]
        XLSX.utils.book_append_sheet(wb, wsMetrics, 'Métricas')
      }

      // Índice de gráficos dentro del Excel
      const chartsIndexRows: any[][] = [['#', 'Título', 'Archivo', 'Resolución']]

      // Capturar gráficos y agregar metadatos
      for (let i = 0; i < chartRefs.length; i++) {
        setExportProgress((i / Math.max(chartRefs.length, 1)) * 75)

        if (!options.includeCharts) continue

        const chartImage = await captureChart(chartRefs[i], chartTitles[i])
        if (!chartImage) continue

        const imageFileName = `graficos/${String(i + 1).padStart(2, '0')}_${sanitizeFileName(chartTitles[i])}.${options.chartFormat}`
        zipEntries.push({ fileName: imageFileName, dataURL: chartImage.dataURL })

        chartsIndexRows.push([
          i + 1,
          chartTitles[i],
          imageFileName,
          `${chartImage.width}x${chartImage.height}`
        ])

        const currentChartData = (chartData && chartData[i]) || []
        if (currentChartData.length > 0) {
          const wsChartData = XLSX.utils.json_to_sheet(currentChartData)
          const sheetName = `Datos_${i + 1}`.slice(0, 31)
          XLSX.utils.book_append_sheet(wb, wsChartData, sheetName)
        }
      }
      const wsChartsIndex = XLSX.utils.aoa_to_sheet(chartsIndexRows)
      wsChartsIndex['!cols'] = [{ wch: 6 }, { wch: 42 }, { wch: 48 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, wsChartsIndex, 'Graficos')

      setExportProgress(82)

      // Empaquetar ZIP: Excel + carpeta de gráficos + manifiesto
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const workbookArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      zip.file(`${safeTitle}_reporte_${timestamp}.xlsx`, workbookArray)

      zipEntries.forEach(({ fileName, dataURL }) => {
        const base64 = dataURL.split(',')[1] || ''
        zip.file(fileName, base64, { base64: true })
      })

      const manifest = [
        `Reporte: ${title}`,
        `Generado: ${new Date().toLocaleString('es-ES')}`,
        `Graficos incluidos: ${zipEntries.length}`,
        `Formato: ${options.chartFormat.toUpperCase()}`,
        '',
        'Contenido:',
        `- ${safeTitle}_reporte_${timestamp}.xlsx`,
        '- graficos/*'
      ].join('\n')
      zip.file('LEEME.txt', manifest)

      setExportProgress(92)
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${safeTitle}_excel_graficos_${timestamp}.zip`
      link.click()
      URL.revokeObjectURL(url)

      setExportProgress(100)
      onExport?.('excel-charts', true)

    } catch (error) {
      console.error('Error exportando Excel con gráficos:', error)
      onExport?.('excel-charts', false)
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [options, title, chartRefs, chartTitles, metrics, data, chartData, captureChart, onExport, sanitizeFileName])

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Botones de exportación con gráficos */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportAsImage('png')}
          disabled={isExporting}
          className="gap-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-800/30 dark:hover:to-pink-800/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300"
          title="Exportar gráficos como imágenes PNG"
        >
          {isExporting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <FileImage className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          )}
          Imágenes
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportPDFWithCharts}
          disabled={isExporting}
          className="gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-800/30 dark:hover:to-indigo-800/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
          title="Exportar PDF completo con gráficos incluidos"
        >
          {isExporting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          )}
          PDF + Gráficos
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportExcelOnly}
          disabled={isExporting}
          className="gap-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-800/30 dark:hover:to-emerald-800/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300"
          title="Exportar Excel con datos (sin gráficos)"
        >
          {isExporting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          )}
          Excel
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportExcelWithCharts}
          disabled={isExporting}
          className="gap-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-800/30 dark:hover:to-emerald-800/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300"
          title="Exportar Excel + gráficos en un ZIP"
        >
          {isExporting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <BarChart3 className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
          Excel + Gráficos (ZIP)
        </Button>
      </div>

      {/* Configuración avanzada */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80">
            <Palette className="h-4 w-4" />
            Opciones
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" align="end">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Camera className="h-4 w-4" />
                Configuración de Gráficos
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-charts" className="text-sm text-slate-700 dark:text-slate-300">Incluir gráficos</Label>
                  <Switch
                    id="include-charts"
                    checked={options.includeCharts}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeCharts: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-data" className="text-sm text-slate-700 dark:text-slate-300">Incluir datos</Label>
                  <Switch
                    id="include-data"
                    checked={options.includeData}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeData: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-metrics" className="text-sm text-slate-700 dark:text-slate-300">Incluir métricas</Label>
                  <Switch
                    id="include-metrics"
                    checked={options.includeMetrics}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeMetrics: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-3">
              <div>
                <Label className="text-sm text-slate-700 dark:text-slate-300">Calidad de imagen</Label>
                <Select 
                  value={options.chartQuality} 
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    setOptions(prev => ({ ...prev, chartQuality: value }))
                  }
                >
                  <SelectTrigger className="w-full mt-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                    <SelectItem value="low" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">Baja (rápida)</SelectItem>
                    <SelectItem value="medium" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">Media (balanceada)</SelectItem>
                    <SelectItem value="high" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">Alta (mejor calidad)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-slate-700 dark:text-slate-300">Formato de imagen</Label>
                <Select 
                  value={options.chartFormat} 
                  onValueChange={(value: 'png' | 'jpeg') => 
                    setOptions(prev => ({ ...prev, chartFormat: value }))
                  }
                >
                  <SelectTrigger className="w-full mt-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                    <SelectItem value="png" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">PNG (sin pérdida)</SelectItem>
                    <SelectItem value="jpeg" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">JPEG (comprimido)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-slate-700 dark:text-slate-300">Orientación de página</Label>
                <Select 
                  value={options.pageLayout} 
                  onValueChange={(value: 'portrait' | 'landscape') => 
                    setOptions(prev => ({ ...prev, pageLayout: value }))
                  }
                >
                  <SelectTrigger className="w-full mt-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                    <SelectItem value="portrait" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">Vertical</SelectItem>
                    <SelectItem value="landscape" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">Horizontal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-slate-700 dark:text-slate-300">Gráficos por página (PDF)</Label>
                <Select
                  value={String(options.pdfChartsPerPage)}
                  onValueChange={(value: '1' | '2' | '4') =>
                    setOptions(prev => ({ ...prev, pdfChartsPerPage: Number(value) as 1 | 2 | 4 }))
                  }
                >
                  <SelectTrigger className="w-full mt-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                    <SelectItem value="1" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">1 (detallado)</SelectItem>
                    <SelectItem value="2" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">2 (compacto)</SelectItem>
                    <SelectItem value="4" className="text-slate-900 dark:text-slate-100 focus:bg-slate-100 dark:focus:bg-slate-700">4 (resumen)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Indicador de progreso */}
      {isExporting && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Zap className="h-4 w-4 text-yellow-500 dark:text-yellow-400 animate-pulse" />
            Procesando gráficos...
          </div>
          
          <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400"
              initial={{ width: 0 }}
              animate={{ width: `${exportProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            {Math.round(exportProgress)}%
          </Badge>
        </motion.div>
      )}
    </div>
  )
}



