'use client'

import React, { useCallback, useRef, useState } from 'react'
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle, Download, Loader2, AlertCircle, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  parseImportFile,
  downloadProductTemplate,
  type ImportProductRow,
  type ParseImportResult,
} from '@/lib/products/import-export-utils'
import { formatCurrencyCompact } from '@/lib/currency'
import { cn } from '@/lib/utils'

export type ImportOptions = {
  updateExisting?: boolean
  onProgress?: (current: number, total: number) => void
}

export type ImportResult = {
  success: number
  failed: number
  updated?: number
  errors: Array<{ row: number; error: string }>
}

export interface ImportProductsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (products: ImportProductRow[], options?: ImportOptions) => Promise<ImportResult>
}

export function ImportProductsModal({ open, onOpenChange, onImport }: ImportProductsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parseResult, setParseResult] = useState<ParseImportResult | null>(null)
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [parseError, setParseError] = useState('')
  const [updateExisting, setUpdateExisting] = useState(true)
  const [activePreviewTab, setActivePreviewTab] = useState<'all' | 'valid' | 'invalid'>('all')

  // Execution state
  const [importing, setImporting] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = useCallback(() => {
    setParseResult(null)
    setIsReadingFile(false)
    setParseError('')
    setImporting(false)
    setProgressPercent(0)
    setProgressText('')
    setResult(null)
    setActivePreviewTab('all')
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseError('')
    setResult(null)
    setIsReadingFile(true)

    try {
      const parsed = await parseImportFile(file)
      if (parsed.totalRows === 0) {
        setParseError('No se encontraron productos en el archivo.')
        setParseResult(null)
      } else {
        setParseResult(parsed)
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error al procesar el archivo')
      setParseResult(null)
    } finally {
      setIsReadingFile(false)
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!parseResult) return
    const rowsToImport = parseResult.allRows.filter((r) => r.status !== 'invalid')

    if (rowsToImport.length === 0) {
      toast.error('No hay filas válidas para importar')
      return
    }

    setImporting(true)
    setProgressPercent(5)
    setProgressText(`Iniciando importación de ${rowsToImport.length} productos...`)

    try {
      const importResult = await onImport(rowsToImport, {
        updateExisting,
        onProgress: (current, total) => {
          const pct = Math.min(98, Math.round((current / total) * 100))
          setProgressPercent(pct)
          setProgressText(`Procesando producto ${current} de ${total}...`)
        },
      })

      setProgressPercent(100)
      setProgressText('¡Importación completada!')
      setResult(importResult)

      if (importResult.success > 0 || (importResult.updated && importResult.updated > 0)) {
        const msg = [
          importResult.success > 0 ? `${importResult.success} creados` : '',
          importResult.updated && importResult.updated > 0 ? `${importResult.updated} actualizados` : '',
        ]
          .filter(Boolean)
          .join(' y ')

        toast.success(`Importación exitosa: ${msg}`)
      }

      if (importResult.failed > 0) {
        toast.warning(`${importResult.failed} productos no pudieron procesarse`)
      }
    } catch (err) {
      toast.error('Error durante la importación')
      setParseError(err instanceof Error ? err.message : 'Error desconocido al importar')
    } finally {
      setImporting(false)
    }
  }, [parseResult, updateExisting, onImport])

  const rowsToDisplay = React.useMemo(() => {
    if (!parseResult) return []
    if (activePreviewTab === 'valid') return parseResult.validRows.concat(parseResult.warningRows)
    if (activePreviewTab === 'invalid') return parseResult.invalidRows
    return parseResult.allRows
  }, [parseResult, activePreviewTab])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !importing) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-5 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Upload className="h-4 w-4" />
            </div>
            <span>Importación de Productos</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cargá tu catálogo en formato <strong>Excel (.xlsx / .xls)</strong> o <strong>CSV</strong>. El sistema detecta automáticamente las columnas y normaliza precios e inventario.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* Zona 1: Plantillas de descarga rápida */}
          {!parseResult && !result && (
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ¿No sabés qué formato usar? Descargá una plantilla con ejemplos:
                </span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadProductTemplate('xlsx')}
                  className="h-8 px-3 text-xs gap-1.5 rounded-lg border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Plantilla Excel (.xlsx)</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-emerald-200/60 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">Recomendado</Badge>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadProductTemplate('csv')}
                  className="h-8 px-2.5 text-xs gap-1.5 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  <span>Plantilla CSV (.csv)</span>
                </Button>
              </div>
            </div>
          )}

          {/* Zona 2: Dropzone de carga de archivo */}
          {!parseResult && !result && (
            <div
              className={cn(
                'relative flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed p-8 transition-all cursor-pointer text-center',
                isReadingFile
                  ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/30 animate-pulse'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-slate-800/60'
              )}
              onClick={() => fileRef.current?.click()}
            >
              {isReadingFile ? (
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shadow-xs">
                  <Upload className="h-6 w-6" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {isReadingFile ? 'Analizando archivo...' : 'Arrastrá tu archivo aquí o hacé clic para seleccionar'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Formatos soportados: <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong> (hasta 1.000 productos)
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="sr-only"
              />
            </div>
          )}

          {/* Zona de Error de Lectura */}
          {parseError && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold">Error de lectura o formato</AlertTitle>
              <AlertDescription className="text-xs">{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Zona 3: Previsualización Inteligente del Archivo */}
          {parseResult && !result && (
            <div className="space-y-3.5">
              {/* Resumen del Archivo y Switch de Actualización */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {parseResult.fileName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {parseResult.totalRows} filas leídas · {parseResult.validRows.length + parseResult.warningRows.length} listas para importar
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={importing}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0 self-end sm:self-auto"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Cambiar archivo
                </Button>
              </div>

              {/* Opción: Actualizar existentes si coinciden por SKU o Código de Barras */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30">
                <div className="space-y-0.5 pr-3">
                  <label htmlFor="update-existing" className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer">
                    Actualizar si ya existe (por SKU o código de barras)
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Si un producto en el archivo ya existe en tu catálogo, se actualizarán su precio y stock en vez de rechazarlo.
                  </p>
                </div>
                <Switch
                  id="update-existing"
                  checked={updateExisting}
                  onCheckedChange={setUpdateExisting}
                  disabled={importing}
                />
              </div>

              {/* Tabs de Filtro de Previsualización */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreviewTab === 'all' ? 'default' : 'ghost'}
                      onClick={() => setActivePreviewTab('all')}
                      className="h-7 px-2.5 text-xs rounded-lg"
                    >
                      Todos ({parseResult.totalRows})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreviewTab === 'valid' ? 'default' : 'ghost'}
                      onClick={() => setActivePreviewTab('valid')}
                      className="h-7 px-2.5 text-xs rounded-lg text-emerald-700 dark:text-emerald-400"
                    >
                      Válidos ({parseResult.validRows.length + parseResult.warningRows.length})
                    </Button>
                    {parseResult.invalidRows.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant={activePreviewTab === 'invalid' ? 'destructive' : 'ghost'}
                        onClick={() => setActivePreviewTab('invalid')}
                        className="h-7 px-2.5 text-xs rounded-lg"
                      >
                        Con errores ({parseResult.invalidRows.length})
                      </Button>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Mostrando primeros {Math.min(50, rowsToDisplay.length)} registros
                  </span>
                </div>

                {/* Tabla de Registros */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-56 overflow-y-auto text-xs bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-[11px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="p-2 w-10">Fila</th>
                        <th className="p-2">Producto</th>
                        <th className="p-2">SKU</th>
                        <th className="p-2 text-right">Precio Venta</th>
                        <th className="p-2 text-center">Stock</th>
                        <th className="p-2">Categoría</th>
                        <th className="p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rowsToDisplay.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className={cn(
                          row.status === 'invalid' ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        )}>
                          <td className="p-2 text-muted-foreground font-mono">{row.rawRowIndex}</td>
                          <td className="p-2 font-semibold text-slate-900 dark:text-white truncate max-w-[160px]">
                            {row.name || <span className="text-rose-500 italic">Sin nombre</span>}
                          </td>
                          <td className="p-2 font-mono text-[11px] text-muted-foreground">
                            {row.sku || <span className="text-slate-400 italic">Auto</span>}
                          </td>
                          <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">
                            {row.sale_price ? formatCurrencyCompact(row.sale_price) : <span className="text-rose-500">0</span>}
                          </td>
                          <td className="p-2 text-center font-medium">
                            {row.stock_quantity ?? 0}
                          </td>
                          <td className="p-2 text-muted-foreground truncate max-w-[100px]">
                            {row.category || '-'}
                          </td>
                          <td className="p-2">
                            {row.status === 'valid' && (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40">Listo</Badge>
                            )}
                            {row.status === 'warning' && (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">Aviso</Badge>
                            )}
                            {row.status === 'invalid' && (
                              <Badge variant="destructive" className="text-[10px]" title={row.validationErrors?.join(', ')}>Error</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Zona 4: Progreso en Vivo durante la Importación */}
          {importing && (
            <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 p-5 space-y-3 text-center animate-in fade-in">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Importando catálogo de productos...
                </p>
                <p className="text-xs text-muted-foreground">
                  {progressText}
                </p>
              </div>
              <Progress value={progressPercent} className="h-2.5" />
              <p className="text-[11px] font-mono text-muted-foreground">{progressPercent}%</p>
            </div>
          )}

          {/* Zona 5: Reporte de Resultados al Finalizar */}
          {result && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30">
                  <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{result.success}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">Creados con éxito</p>
                </div>

                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30">
                  <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{result.updated ?? 0}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">Actualizados</p>
                </div>

                <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30">
                  <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{result.failed}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">Rechazados</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-3 space-y-2">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Detalle de errores en el archivo ({result.errors.length}):
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-xs text-rose-700 dark:text-rose-400 font-mono">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="font-bold">Fila {err.row}:</span>
                        <span>{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
            disabled={importing}
            className="rounded-xl text-xs"
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </Button>

          {!result && parseResult && (
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={importing || parseResult.validRows.length + parseResult.warningRows.length === 0}
              className="rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-xs"
            >
              {importing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>
                    Importar {parseResult.validRows.length + parseResult.warningRows.length} productos
                  </span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
