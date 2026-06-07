'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle2, Download, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

type ImportRow = {
  name: string
  sku?: string
  description?: string
  brand?: string
  category?: string
  purchase_price?: number
  sale_price: number
  stock_quantity?: number
  min_stock?: number
  barcode?: string
  unit_measure?: string
}

type ImportResult = {
  success: number
  failed: number
  errors: Array<{ row: number; error: string }>
}

export interface ImportProductsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (products: ImportRow[]) => Promise<ImportResult>
}

const CSV_TEMPLATE_HEADERS = [
  'nombre', 'sku', 'descripcion', 'marca', 'categoria',
  'precio_compra', 'precio_venta', 'stock', 'stock_minimo',
  'codigo_barras', 'unidad_medida'
]

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i++
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const rows: ImportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })

    const name = row['nombre'] || row['name'] || ''
    const salePrice = parseFloat(row['precio_venta'] || row['sale_price'] || '0')

    if (!name || !salePrice) continue

    rows.push({
      name,
      sku: row['sku'] || undefined,
      description: row['descripcion'] || row['description'] || undefined,
      brand: row['marca'] || row['brand'] || undefined,
      category: row['categoria'] || row['category'] || undefined,
      purchase_price: parseFloat(row['precio_compra'] || row['purchase_price'] || '0') || undefined,
      sale_price: salePrice,
      stock_quantity: parseInt(row['stock'] || row['stock_quantity'] || '0') || 0,
      min_stock: parseInt(row['stock_minimo'] || row['min_stock'] || '0') || undefined,
      barcode: row['codigo_barras'] || row['barcode'] || undefined,
      unit_measure: row['unidad_medida'] || row['unit_measure'] || undefined,
    })
  }

  return rows
}

function downloadTemplate() {
  const csv = CSV_TEMPLATE_HEADERS.join(',') + '\n' +
    '"Cargador USB-C","SKU-001","Cargador rapido 20W","Samsung","Accesorios",15000,25000,50,5,7891234567890,"unidad"\n' +
    '"Funda iPhone 15","SKU-002","Funda transparente, antishock","Generic","Fundas",8000,18000,100,10,,"unidad"\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-productos.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ImportProductsModal({ open, onOpenChange, onImport }: ImportProductsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState('')

  const reset = useCallback(() => {
    setParsedRows([])
    setFileName('')
    setResult(null)
    setParseError('')
    setProgress(0)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseError('')
    setResult(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const rows = parseCSV(text)
        if (rows.length === 0) {
          setParseError('No se encontraron productos válidos. Verificá que el CSV tenga las columnas correctas (nombre, precio_venta son obligatorios).')
          setParsedRows([])
        } else {
          setParsedRows(rows)
        }
      } catch {
        setParseError('Error al leer el archivo. Asegurate de que sea un CSV válido.')
        setParsedRows([])
      }
    }
    reader.readAsText(file)
  }, [])

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    setProgress(10)

    try {
      setProgress(30)
      const importResult = await onImport(parsedRows)
      setProgress(100)
      setResult(importResult)

      if (importResult.success > 0) {
        toast.success(`${importResult.success} producto${importResult.success > 1 ? 's' : ''} importado${importResult.success > 1 ? 's' : ''} correctamente`)
      }
      if (importResult.failed > 0) {
        toast.warning(`${importResult.failed} producto${importResult.failed > 1 ? 's' : ''} no se pudieron importar`)
      }
    } catch (err) {
      toast.error('Error durante la importación')
      setParseError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setImporting(false)
    }
  }, [parsedRows, onImport])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar productos
          </DialogTitle>
          <DialogDescription>
            Cargá un archivo CSV con tus productos. Descargá la plantilla para ver el formato esperado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download template */}
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Descargar plantilla CSV
          </Button>

          {/* File input */}
          <div
            className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-600 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <FileText className="h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {fileName || 'Click para seleccionar archivo CSV'}
            </p>
            <p className="text-xs text-slate-400">Formato: .csv · Máximo 1000 productos por importación</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {parsedRows.length > 0 && !result && (
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  <Badge variant="secondary">{parsedRows.length}</Badge> productos listos para importar
                </p>
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                {parsedRows.slice(0, 5).map((row, i) => (
                  <p key={i} className="truncate">
                    {row.name} — {row.sale_price?.toLocaleString('es-PY')} Gs.
                    {row.stock_quantity ? ` · Stock: ${row.stock_quantity}` : ''}
                  </p>
                ))}
                {parsedRows.length > 5 && (
                  <p className="text-slate-400">... y {parsedRows.length - 5} más</p>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">Importando productos...</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">{result.success} importados</span>
                {result.failed > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">{result.failed} con errores</span>
                  </>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-24 overflow-y-auto text-xs text-red-500 space-y-0.5">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <p key={i}>Fila {err.row}: {err.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
            {result ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={parsedRows.length === 0 || importing}
              className="gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {parsedRows.length} producto{parsedRows.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
