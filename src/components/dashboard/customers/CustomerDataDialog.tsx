"use client"

/**
 * CustomerDataDialog - Componente consolidado
 * 
 * Combina funcionalidades de ExportDialog e ImportCustomersDialog
 * en un solo componente unificado con tabs para exportar e importar datos.
 * 
 * Características:
 * - Tab de exportación con múltiples formatos
 * - Tab de importación con drag & drop
 * - Validación y preview de datos
 * - Progreso de operaciones
 * - Manejo de errores unificado
 */

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Download,
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  Users,
  CheckCircle,
  Info,
  AlertCircle,
  X,
  AlertTriangle,
  Eye
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { Customer } from '@/hooks/use-customer-state'
import { exportCustomers, exportFields, fieldLabels, getExportStats, ExportOptions } from '@/utils/export-utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ExportPreviewModal } from './ExportPreviewModal'

interface CustomerDataDialogProps {
  customers: Customer[]
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'export' | 'import'
  onImport?: (file: File) => Promise<{ success: boolean; imported?: number; errors?: string[]; error?: string }>
}

interface ImportResult {
  success: boolean
  imported: number
  errors: string[]
  total: number
}

const formatIcons = {
  csv: FileText,
  excel: FileSpreadsheet,
  pdf: FileImage
}

const formatDescriptions = {
  csv: 'Archivo de valores separados por comas, compatible con Excel y otras aplicaciones',
  excel: 'Archivo de Microsoft Excel con formato de tabla',
  pdf: 'Documento PDF listo para imprimir o compartir'
}

export function CustomerDataDialog({ 
  customers, 
  isOpen, 
  onClose, 
  defaultTab = 'export',
  onImport 
}: CustomerDataDialogProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  
  // Export states
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv')
  const [selectedFields, setSelectedFields] = useState<string[]>(exportFields.complete)
  const [fileName, setFileName] = useState('clientes')
  const [exporting, setExporting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  
  // Import states
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload')

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      toast.error('Selecciona al menos un campo para exportar')
      return
    }

    setExporting(true)
    try {
      const options: ExportOptions = {
        format: exportFormat,
        fields: selectedFields,
        filename: fileName
      }
      
      // Mostrar toast de inicio
      toast.loading('Preparando exportación...', { id: 'export-toast' })
      
      await exportCustomers(customers, options)
      
      // Actualizar toast de éxito
      toast.success(`${customers.length} clientes exportados exitosamente como ${exportFormat.toUpperCase()}`, { 
        id: 'export-toast',
        duration: 4000 
      })
      
      // Cerrar modal después de un breve delay
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Error al exportar:', error)
      toast.error('Error al exportar los datos', { id: 'export-toast' })
    } finally {
      setExporting(false)
    }
  }

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }

  const selectAllFields = () => {
    setSelectedFields(exportFields.complete)
  }

  const clearAllFields = () => {
    setSelectedFields([])
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(csv|xlsx|xls)$/i)) {
        toast.error('Solo se permiten archivos CSV o Excel')
        return
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB
        toast.error('El archivo es demasiado grande. Máximo 10MB')
        return
      }
      
      setFile(selectedFile)
      setStep('preview')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  })

  const handleImport = async () => {
    if (!file || !onImport) return

    setImporting(true)
    setStep('importing')
    setProgress(0)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90))
    }, 200)

    try {
      const importResult = await onImport(file)
      clearInterval(progressInterval)
      setProgress(100)

      if (importResult.success) {
        setResult({
          success: true,
          imported: importResult.imported || 0,
          errors: importResult.errors || [],
          total: importResult.imported || 0
        })
        toast.success(`${importResult.imported} clientes importados exitosamente`)
      } else {
        setResult({
          success: false,
          imported: 0,
          errors: [importResult.error || 'Error desconocido'],
          total: 0
        })
        toast.error('Error al importar clientes')
      }
      setStep('result')
    } catch (error) {
      clearInterval(progressInterval)
      console.error('Error importing:', error)
      setResult({
        success: false,
        imported: 0,
        errors: ['Error al procesar el archivo'],
        total: 0
      })
      setStep('result')
      toast.error('Error al importar el archivo')
    } finally {
      setImporting(false)
    }
  }

  const resetImport = () => {
    setFile(null)
    setStep('upload')
    setProgress(0)
    setResult(null)
  }

  const handleClose = () => {
    if (!importing && !exporting) {
      resetImport()
      onClose()
    }
  }

  const stats = getExportStats(customers, selectedFields)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6" />
            Gestión de Datos de Clientes
          </DialogTitle>
          <DialogDescription className="text-base">
            Exporta o importa datos de clientes en diferentes formatos
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'export' | 'import')} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0 mb-4">
              <TabsTrigger value="export" className="flex items-center gap-2 text-base py-3">
                <Download className="h-5 w-5" />
                Exportar
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2 text-base py-3">
                <Upload className="h-5 w-5" />
                Importar
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden min-h-0">
              <TabsContent value="export" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                  <div className="space-y-8 pb-6">
                    {/* Header con estadísticas rápidas */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            Exportar Datos de Clientes
                          </h3>
                          <p className="text-base text-gray-600 dark:text-gray-400">
                            Configura y descarga tus datos en el formato que prefieras
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{customers.length}</div>
                            <div className="text-sm text-gray-500">Clientes</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">{selectedFields.length}</div>
                            <div className="text-sm text-gray-500">Campos</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                      {/* Paso 1: Configuración Básica */}
                      <Card className="xl:col-span-3 h-fit">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                            Configuración
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div>
                            <Label htmlFor="fileName" className="text-base font-medium mb-3 block">
                              Nombre del archivo
                            </Label>
                            <Input
                              id="fileName"
                              value={fileName}
                              onChange={(e) => setFileName(e.target.value)}
                              placeholder="clientes"
                              className="text-base h-12"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-base font-medium mb-4 block">
                              Formato de exportación
                            </Label>
                            <RadioGroup value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                              <div className="space-y-3">
                                {Object.entries(formatDescriptions).map(([format, description]) => {
                                  const Icon = formatIcons[format as keyof typeof formatIcons]
                                  return (
                                    <div 
                                      key={format} 
                                      className={cn(
                                        "flex items-start space-x-4 p-4 border-2 rounded-xl cursor-pointer transition-all",
                                        exportFormat === format 
                                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md" 
                                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                      )}
                                    >
                                      <RadioGroupItem value={format} id={format} className="mt-1" />
                                      <div className="flex-1 min-w-0">
                                        <Label htmlFor={format} className="flex items-center gap-3 font-medium cursor-pointer text-base">
                                          <Icon className="h-5 w-5 flex-shrink-0" />
                                          {format.toUpperCase()}
                                        </Label>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                                          {description}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </RadioGroup>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Paso 2: Selección de Campos */}
                      <Card className="xl:col-span-6 h-fit">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                              Seleccionar Campos
                            </div>
                            <Badge variant="outline" className="text-sm px-3 py-1">
                              {selectedFields.length} de {exportFields.complete.length}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Plantillas Rápidas */}
                          <div>
                            <Label className="text-base font-medium mb-4 block">
                              🚀 Plantillas rápidas
                            </Label>
                            <div className="grid grid-cols-2 gap-4">
                              <Button
                                type="button"
                                variant={JSON.stringify(selectedFields.sort()) === JSON.stringify(exportFields.basic.sort()) ? "default" : "outline"}
                                size="lg"
                                onClick={() => setSelectedFields(exportFields.basic)}
                                className="justify-start text-sm h-auto py-4"
                              >
                                <div className="flex flex-col items-start">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">📋</span>
                                    <span className="font-medium">Básico</span>
                                  </div>
                                  <span className="text-xs opacity-70 mt-1">{exportFields.basic.length} campos esenciales</span>
                                </div>
                              </Button>
                              
                              <Button
                                type="button"
                                variant={JSON.stringify(selectedFields.sort()) === JSON.stringify(exportFields.contact.sort()) ? "default" : "outline"}
                                size="lg"
                                onClick={() => setSelectedFields(exportFields.contact)}
                                className="justify-start text-sm h-auto py-4"
                              >
                                <div className="flex flex-col items-start">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">📞</span>
                                    <span className="font-medium">Contacto</span>
                                  </div>
                                  <span className="text-xs opacity-70 mt-1">{exportFields.contact.length} campos de contacto</span>
                                </div>
                              </Button>
                              
                              <Button
                                type="button"
                                variant={JSON.stringify(selectedFields.sort()) === JSON.stringify(exportFields.financial.sort()) ? "default" : "outline"}
                                size="lg"
                                onClick={() => setSelectedFields(exportFields.financial)}
                                className="justify-start text-sm h-auto py-4"
                              >
                                <div className="flex flex-col items-start">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">💰</span>
                                    <span className="font-medium">Financiero</span>
                                  </div>
                                  <span className="text-xs opacity-70 mt-1">{exportFields.financial.length} campos financieros</span>
                                </div>
                              </Button>
                              
                              <Button
                                type="button"
                                variant={selectedFields.length === exportFields.complete.length ? "default" : "outline"}
                                size="lg"
                                onClick={selectAllFields}
                                className="justify-start text-sm h-auto py-4"
                              >
                                <div className="flex flex-col items-start">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">✅</span>
                                    <span className="font-medium">Completo</span>
                                  </div>
                                  <span className="text-xs opacity-70 mt-1">{exportFields.complete.length} todos los campos</span>
                                </div>
                              </Button>
                            </div>
                          </div>

                          <Separator />

                          {/* Selección Manual */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <Label className="text-base font-medium">
                                🎯 Selección personalizada
                              </Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={clearAllFields}
                                disabled={selectedFields.length === 0}
                                className="text-sm h-8"
                              >
                                Limpiar todo
                              </Button>
                            </div>

                            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/50">
                              <div className="max-h-64 overflow-y-auto pr-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {exportFields.complete.map((field) => (
                                    <div key={field} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                      <Checkbox
                                        id={field}
                                        checked={selectedFields.includes(field)}
                                        onCheckedChange={() => handleFieldToggle(field)}
                                        className="flex-shrink-0"
                                      />
                                      <Label htmlFor={field} className="text-sm cursor-pointer flex-1 leading-relaxed">
                                        {fieldLabels[field] || field}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Paso 3: Resumen y Descarga */}
                      <Card className="xl:col-span-3 h-fit">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                            Descargar
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Resumen Visual */}
                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 space-y-4 border">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Archivo:</span>
                              <Badge variant="secondary" className="text-sm px-3 py-1">
                                {fileName || 'clientes'}.{exportFormat}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Registros:</span>
                              <Badge variant="secondary" className="text-sm px-3 py-1">
                                {stats.totalRecords}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Campos:</span>
                              <Badge variant="secondary" className="text-sm px-3 py-1">
                                {stats.selectedFields}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Tamaño:</span>
                              <Badge variant="outline" className="text-sm px-3 py-1">
                                {stats.estimatedSize}
                              </Badge>
                            </div>
                          </div>

                          {/* Botones de Acción */}
                          <div className="space-y-4">
                            <Button 
                              variant="outline"
                              onClick={() => setShowPreview(true)}
                              disabled={selectedFields.length === 0}
                              className="w-full text-base h-12"
                              size="lg"
                            >
                              <Eye className="h-5 w-5 mr-3" />
                              Vista Previa
                            </Button>
                            
                            <Button 
                              onClick={handleExport} 
                              disabled={exporting || selectedFields.length === 0}
                              className="w-full text-base font-medium h-14"
                              size="lg"
                            >
                              {exporting ? (
                                <>
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="mr-3"
                                  >
                                    <Download className="h-5 w-5" />
                                  </motion.div>
                                  Generando...
                                </>
                              ) : (
                                <>
                                  <Download className="h-5 w-5 mr-3" />
                                  Descargar Ahora
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Mensajes de Estado */}
                          {selectedFields.length === 0 && (
                            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                ⚠️ Selecciona al menos un campo
                              </p>
                            </div>
                          )}
                          
                          {exporting && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                              <div className="flex items-center justify-center space-x-3 mb-3">
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <Download className="h-5 w-5 text-blue-600" />
                                </motion.div>
                                <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                                  Procesando...
                                </span>
                              </div>
                              <p className="text-center text-sm text-blue-600 dark:text-blue-400">
                                Generando {exportFormat.toUpperCase()}
                              </p>
                            </div>
                          )}

                          {/* Tips de Ayuda */}
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <div className="flex items-start gap-3">
                              <Info className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                                  💡 Consejos útiles:
                                </p>
                                <ul className="text-sm text-indigo-600 dark:text-indigo-400 space-y-1">
                                  <li>• CSV: Compatible con Excel</li>
                                  <li>• Excel: Formato nativo de Microsoft</li>
                                  <li>• PDF: Listo para imprimir</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Barra de Progreso Visual */}
                    <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-xl border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-medium text-gray-700 dark:text-gray-300">
                          Progreso de configuración
                        </span>
                        <span className="text-base text-gray-500">
                          {Math.round(((fileName ? 1 : 0) + (selectedFields.length > 0 ? 1 : 0)) / 2 * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${((fileName ? 1 : 0) + (selectedFields.length > 0 ? 1 : 0)) / 2 * 100}%` 
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-3 text-sm text-gray-500">
                        <span className={fileName ? "text-green-600 font-medium" : ""}>
                          {fileName ? "✓" : "○"} Configuración
                        </span>
                        <span className={selectedFields.length > 0 ? "text-green-600 font-medium" : ""}>
                          {selectedFields.length > 0 ? "✓" : "○"} Campos seleccionados
                        </span>
                      </div>
                    </div>

                    {/* Sección adicional para forzar scroll */}
                    <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border border-green-100 dark:border-green-800">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        📊 Estadísticas Detalladas
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border">
                          <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
                          <div className="text-xs text-gray-500">Activos</div>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border">
                          <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
                          <div className="text-xs text-gray-500">Inactivos</div>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border">
                          <div className="text-2xl font-bold text-purple-600">{stats.premium}</div>
                          <div className="text-xs text-gray-500">Premium</div>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border">
                          <div className="text-2xl font-bold text-orange-600">{stats.empresa}</div>
                          <div className="text-xs text-gray-500">Empresas</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="import" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                  <div className="space-y-8 pb-6">
                    <AnimatePresence mode="wait">
                      {step === 'upload' && (
                        <motion.div
                          key="upload"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="space-y-8"
                        >
                          <div
                            {...getRootProps()}
                            className={cn(
                              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
                              isDragActive
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                            )}
                          >
                            <input {...getInputProps()} />
                            <Upload className="h-16 w-16 mx-auto mb-6 text-gray-400" />
                            <h3 className="text-xl font-medium mb-4">
                              {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo o haz clic para seleccionar'}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6 text-base">
                              Formatos soportados: CSV, Excel (.xlsx, .xls)
                            </p>
                            <p className="text-sm text-gray-500">
                              Tamaño máximo: 10MB
                            </p>
                          </div>

                          <Alert className="p-6">
                            <Info className="h-5 w-5" />
                            <AlertDescription className="text-base">
                              <strong>Formato esperado:</strong> El archivo debe contener columnas como 'nombre', 'email', 'teléfono', etc.
                              La primera fila debe contener los nombres de las columnas.
                            </AlertDescription>
                          </Alert>
                        </motion.div>
                      )}

                      {step === 'preview' && file && (
                        <motion.div
                          key="preview"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="space-y-8"
                        >
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-3 text-xl">
                                <FileText className="h-6 w-6" />
                                Archivo seleccionado
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-lg">{file.name}</p>
                                  <p className="text-base text-gray-600">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="lg"
                                  onClick={resetImport}
                                >
                                  <X className="h-5 w-5 mr-2" />
                                  Cambiar archivo
                                </Button>
                              </div>
                            </CardContent>
                          </Card>

                          <Alert className="p-6">
                            <AlertTriangle className="h-5 w-5" />
                            <AlertDescription className="text-base">
                              <strong>Importante:</strong> La importación sobrescribirá los datos existentes si encuentra coincidencias por email.
                              Asegúrate de tener una copia de seguridad antes de continuar.
                            </AlertDescription>
                          </Alert>

                          <div className="flex gap-4">
                            <Button variant="outline" onClick={resetImport} size="lg">
                              Cancelar
                            </Button>
                            <Button onClick={handleImport} disabled={!onImport} size="lg">
                              <Upload className="h-5 w-5 mr-2" />
                              Importar datos
                            </Button>
                          </div>
                        </motion.div>
                      )}

                      {step === 'importing' && (
                        <motion.div
                          key="importing"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="space-y-8"
                        >
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-3 text-xl">
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                >
                                  <Upload className="h-6 w-6" />
                                </motion.div>
                                Importando datos...
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Progress value={progress} className="mb-6 h-3" />
                              <p className="text-center text-gray-600 text-base">
                                {progress < 100 ? 'Procesando archivo...' : 'Finalizando importación...'}
                              </p>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}

                      {step === 'result' && result && (
                        <motion.div
                          key="result"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="space-y-8"
                        >
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-3 text-xl">
                                {result.success ? (
                                  <CheckCircle className="h-6 w-6 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-6 w-6 text-red-600" />
                                )}
                                {result.success ? 'Importación completada' : 'Error en la importación'}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {result.success ? (
                                <div className="space-y-6">
                                  <div className="grid grid-cols-2 gap-6">
                                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                                      <div className="text-3xl font-bold text-green-600">{result.imported}</div>
                                      <div className="text-base text-gray-600">Clientes importados</div>
                                    </div>
                                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                      <div className="text-3xl font-bold text-blue-600">{result.total}</div>
                                      <div className="text-base text-gray-600">Total procesados</div>
                                    </div>
                                  </div>
                                  
                                  {result.errors.length > 0 && (
                                    <Alert className="p-6">
                                      <AlertTriangle className="h-5 w-5" />
                                      <AlertDescription className="text-base">
                                        <strong>Advertencias:</strong>
                                        <ul className="mt-3 list-disc list-inside space-y-1">
                                          {result.errors.slice(0, 5).map((error, index) => (
                                            <li key={index} className="text-sm">{error}</li>
                                          ))}
                                          {result.errors.length > 5 && (
                                            <li className="text-sm">... y {result.errors.length - 5} más</li>
                                          )}
                                        </ul>
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                </div>
                              ) : (
                                <Alert className="p-6">
                                  <AlertCircle className="h-5 w-5" />
                                  <AlertDescription className="text-base">
                                    <strong>Errores encontrados:</strong>
                                    <ul className="mt-3 list-disc list-inside space-y-1">
                                      {result.errors.map((error, index) => (
                                        <li key={index} className="text-sm">{error}</li>
                                      ))}
                                    </ul>
                                  </AlertDescription>
                                </Alert>
                              )}
                            </CardContent>
                          </Card>

                          <div className="flex gap-4">
                            <Button variant="outline" onClick={resetImport} size="lg">
                              Importar otro archivo
                            </Button>
                            <Button onClick={handleClose} size="lg">
                              Cerrar
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={exporting || importing}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Modal de vista previa */}
      <ExportPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        customers={customers}
        selectedFields={selectedFields}
        exportFormat={exportFormat}
        onConfirmExport={() => {
          setShowPreview(false)
          handleExport()
        }}
      />
    </Dialog>
  )
}