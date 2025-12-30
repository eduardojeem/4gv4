'use client'

import { useCallback, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { motion } from 'framer-motion'
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
  chartSize: 'small' | 'medium' | 'large'
}

interface ChartExporterProps {
  title: string
  data: any[]
  metrics?: Record<string, any>
  chartRefs: React.RefObject<HTMLDivElement | null>[]
  chartTitles: string[]
  onExport?: (format: string, success: boolean) => void
  className?: string
}

export function ChartExporter({
  title,
  data,
  metrics = {},
  chartRefs,
  chartTitles,
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
    chartSize: 'medium'
  })

  // Función para capturar un gráfico como imagen
  const captureChart = useCallback(async (chartRef: React.RefObject<HTMLDivElement | null>, title: string) => {
    if (!chartRef.current) return null

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: options.chartQuality === 'high' ? 2 : options.chartQuality === 'medium' ? 1.5 : 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
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
    }
  }, [options.chartQuality, options.chartFormat])

  // Función para exportar como imagen individual
  const exportAsImage = useCallback(async (format: 'png' | 'jpeg' | 'svg') => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      
      for (let i = 0; i < chartRefs.length; i++) {
        setExportProgress((i / chartRefs.length) * 100)
        
        const chartImage = await captureChart(chartRefs[i], chartTitles[i])
        if (chartImage) {
          // Crear enlace de descarga
          const link = document.createElement('a')
          link.download = `${title}_${chartTitles[i]}_${timestamp}.${format}`
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
  }, [chartRefs, chartTitles, title, captureChart, onExport])

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

      // Página de portada
      doc.setFontSize(24)
      doc.setTextColor(31, 78, 121)
      doc.text(title, margin, 80)

      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      doc.text(`Reporte Generado el: ${new Date().toLocaleDateString('es-ES')}`, margin, 110)
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

      // Capturar y agregar gráficos
      for (let i = 0; i < chartRefs.length; i++) {
        setExportProgress((i / chartRefs.length) * 80)

        const chartImage = await captureChart(chartRefs[i], chartTitles[i])
        if (chartImage) {
          // Nueva página para cada gráfico
          doc.addPage()

          // Título del gráfico
          doc.setFontSize(16)
          doc.setTextColor(31, 78, 121)
          doc.text(chartTitles[i], margin, 50)

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
          if (options.includeData && data.length > 0) {
            const dataYPos = yPos + chartHeight + 30
            
            doc.setFontSize(12)
            doc.setTextColor(31, 78, 121)
            doc.text('Datos del Gráfico:', margin, dataYPos)

            // Agregar tabla con datos relevantes (primeros 10 registros)
            const tableData = data.slice(0, 10).map(item => 
              Object.values(item).map(val => val?.toString() || '')
            )
            
            if (tableData.length > 0) {
              autoTable(doc, {
                startY: dataYPos + 20,
                head: [Object.keys(data[0] || {})],
                body: tableData,
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [54, 96, 146], textColor: [255, 255, 255] },
                margin: { left: margin, right: margin },
                tableWidth: 'auto'
              })
            }
          }
        }
      }

      setExportProgress(90)

      // Guardar PDF
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      doc.save(`${title}_con_graficos_${timestamp}.pdf`)

      setExportProgress(100)
      onExport?.('pdf-charts', true)

    } catch (error) {
      console.error('Error exportando PDF con gráficos:', error)
      onExport?.('pdf-charts', false)
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [options, title, chartRefs, chartTitles, metrics, data, captureChart, onExport])

  // Función para exportar Excel con gráficos
  const exportExcelWithCharts = useCallback(async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      const wb = XLSX.utils.book_new()

      // Hoja de datos
      if (options.includeData && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data)
        XLSX.utils.book_append_sheet(wb, ws, 'Datos')
      }

      // Hoja de métricas
      if (options.includeMetrics && Object.keys(metrics).length > 0) {
        const metricsData = Object.entries(metrics).map(([key, value]) => ({
          Métrica: key,
          Valor: value
        }))
        const wsMetrics = XLSX.utils.json_to_sheet(metricsData)
        XLSX.utils.book_append_sheet(wb, wsMetrics, 'Métricas')
      }

      // Capturar gráficos y crear hojas con referencias
      for (let i = 0; i < chartRefs.length; i++) {
        setExportProgress((i / chartRefs.length) * 80)

        const chartImage = await captureChart(chartRefs[i], chartTitles[i])
        if (chartImage) {
          // Crear hoja con información del gráfico
          const chartInfo = [
            ['Gráfico', chartTitles[i]],
            ['Generado', new Date().toLocaleString('es-ES')],
            ['Resolución', `${chartImage.width}x${chartImage.height}`],
            ['Formato', options.chartFormat.toUpperCase()],
            ['', ''],
            ['Nota:', 'Los gráficos se exportan como imágenes separadas']
          ]
          
          const wsChart = XLSX.utils.aoa_to_sheet(chartInfo)
          XLSX.utils.book_append_sheet(wb, wsChart, `Gráfico_${i + 1}`)

          // Descargar imagen por separado
          const link = document.createElement('a')
          link.download = `${title}_${chartTitles[i]}_grafico.${options.chartFormat}`
          link.href = chartImage.dataURL
          link.click()
        }
      }

      setExportProgress(90)

      // Guardar Excel
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      XLSX.writeFile(wb, `${title}_con_graficos_${timestamp}.xlsx`)

      setExportProgress(100)
      onExport?.('excel-charts', true)

    } catch (error) {
      console.error('Error exportando Excel con gráficos:', error)
      onExport?.('excel-charts', false)
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [options, title, chartRefs, chartTitles, metrics, data, captureChart, onExport])

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
          onClick={exportExcelWithCharts}
          disabled={isExporting}
          className="gap-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-800/30 dark:hover:to-emerald-800/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300"
          title="Exportar Excel con datos y gráficos"
        >
          {isExporting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <BarChart3 className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
          Excel + Gráficos
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