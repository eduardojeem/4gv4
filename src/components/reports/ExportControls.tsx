'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence  } from '../ui/motion'
import { 
  Download, 
  FileText, 
  BarChart3, 
  RefreshCw, 
  CheckCircle,
  AlertCircle,
  Settings,
  Calendar,
  Filter
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

interface ExportOptions {
  includeCharts?: boolean
  includeMetadata?: boolean
  includeFilters?: boolean
  dateFormat?: 'short' | 'long'
  numberFormat?: 'compact' | 'full'
  pageOrientation?: 'portrait' | 'landscape'
}

interface ExportControlsProps {
  onExport: (format: 'csv' | 'excel' | 'pdf', options?: ExportOptions) => Promise<void>
  isExporting?: boolean
  exportProgress?: number
  dataCount?: number
  className?: string
  showQuickButtons?: boolean
  showAdvancedOptions?: boolean
}

export function ExportControls({
  onExport,
  isExporting = false,
  exportProgress = 0,
  dataCount = 0,
  className = '',
  showQuickButtons = true,
  showAdvancedOptions = true
}: ExportControlsProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'pdf'>('pdf')
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeCharts: true,
    includeMetadata: true,
    includeFilters: true,
    dateFormat: 'short',
    numberFormat: 'compact',
    pageOrientation: 'landscape'
  })
  const [lastExport, setLastExport] = useState<{ format: string; timestamp: Date } | null>(null)

  const handleQuickExport = useCallback(async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      await onExport(format, exportOptions)
      setLastExport({ format: format.toUpperCase(), timestamp: new Date() })
    } catch (error) {
      console.error('Error en exportación rápida:', error)
    }
  }, [onExport, exportOptions])

  const handleAdvancedExport = useCallback(async () => {
    try {
      await onExport(selectedFormat, exportOptions)
      setLastExport({ format: selectedFormat.toUpperCase(), timestamp: new Date() })
    } catch (error) {
      console.error('Error en exportación avanzada:', error)
    }
  }, [onExport, selectedFormat, exportOptions])

  const formatIcons = {
    csv: FileText,
    excel: BarChart3,
    pdf: FileText
  }

  const formatColors = {
    csv: 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20',
    excel: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
    pdf: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Botones de exportación rápida */}
      {showQuickButtons && (
        <div className="flex gap-2">
          {(['csv', 'excel', 'pdf'] as const).map((format) => {
            const Icon = formatIcons[format]
            return (
              <Button
                key={format}
                variant="outline"
                size="sm"
                onClick={() => handleQuickExport(format)}
                disabled={isExporting}
                className={`gap-2 bg-white/80 dark:bg-slate-800/80 transition-all duration-200 ${formatColors[format]}`}
                title={`Exportar como ${format.toUpperCase()}`}
              >
                {isExporting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {format.toUpperCase()}
              </Button>
            )
          })}
        </div>
      )}

      {/* Separador */}
      {showQuickButtons && showAdvancedOptions && (
        <Separator orientation="vertical" className="h-8" />
      )}

      {/* Exportación avanzada */}
      {showAdvancedOptions && (
        <div className="flex items-center gap-2">
          <Select value={selectedFormat} onValueChange={(value: 'csv' | 'excel' | 'pdf') => setSelectedFormat(value)}>
            <SelectTrigger className="w-[140px] bg-white/80 dark:bg-slate-800/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-red-500" />
                  📄 PDF Completo
                </div>
              </SelectItem>
              <SelectItem value="excel">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-green-500" />
                  📊 Excel Avanzado
                </div>
              </SelectItem>
              <SelectItem value="csv">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  📋 CSV Datos
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Opciones avanzadas */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Opciones
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-3">Configuración de Exportación</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-charts" className="text-sm">Incluir gráficos</Label>
                      <Switch
                        id="include-charts"
                        checked={exportOptions.includeCharts}
                        onCheckedChange={(checked) => 
                          setExportOptions(prev => ({ ...prev, includeCharts: checked }))
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-metadata" className="text-sm">Incluir metadatos</Label>
                      <Switch
                        id="include-metadata"
                        checked={exportOptions.includeMetadata}
                        onCheckedChange={(checked) => 
                          setExportOptions(prev => ({ ...prev, includeMetadata: checked }))
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-filters" className="text-sm">Incluir filtros aplicados</Label>
                      <Switch
                        id="include-filters"
                        checked={exportOptions.includeFilters}
                        onCheckedChange={(checked) => 
                          setExportOptions(prev => ({ ...prev, includeFilters: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Formato de fecha</Label>
                    <Select 
                      value={exportOptions.dateFormat} 
                      onValueChange={(value: 'short' | 'long') => 
                        setExportOptions(prev => ({ ...prev, dateFormat: value }))
                      }
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Corto (01/01/2024)</SelectItem>
                        <SelectItem value="long">Largo (1 de enero de 2024)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm">Formato de números</Label>
                    <Select 
                      value={exportOptions.numberFormat} 
                      onValueChange={(value: 'compact' | 'full') => 
                        setExportOptions(prev => ({ ...prev, numberFormat: value }))
                      }
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compacto (1.2M)</SelectItem>
                        <SelectItem value="full">Completo (1,200,000)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedFormat === 'pdf' && (
                    <div>
                      <Label className="text-sm">Orientación de página</Label>
                      <Select 
                        value={exportOptions.pageOrientation} 
                        onValueChange={(value: 'portrait' | 'landscape') => 
                          setExportOptions(prev => ({ ...prev, pageOrientation: value }))
                        }
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="portrait">Vertical</SelectItem>
                          <SelectItem value="landscape">Horizontal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button 
            onClick={handleAdvancedExport}
            disabled={isExporting}
            className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 min-w-[120px]"
          >
            {isExporting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exportar
              </>
            )}
          </Button>
        </div>
      )}

      {/* Indicador de progreso y estado */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center gap-3"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              Procesando {dataCount > 0 ? `${dataCount} registros` : 'datos'}...
            </div>
            
            {exportProgress > 0 && (
              <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${exportProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </motion.div>
        )}

        {lastExport && !isExporting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="secondary" className="text-xs">
              {lastExport.format} exportado
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}