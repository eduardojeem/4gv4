"use client"
import React, { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { parseCSV, detectUserColumnMapping, mapUserRows, validateUserRow, type ColumnMapping, type UserImport } from '@/utils/csv-import'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (rows: UserImport[]) => Promise<void> | void
}

export function ImportUsersDialog({ open, onOpenChange, onImport }: Props) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [preview, setPreview] = useState<UserImport[]>([])
  const [loading, setLoading] = useState(false)

  const requiredFilled = useMemo(() => mapping.name !== undefined && mapping.email !== undefined, [mapping])

  const handleFile = async (file?: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      if (!parsed.headers.length) {
        toast.error('El archivo CSV no contiene encabezados válidos')
        return
      }
      setHeaders(parsed.headers)
      setRawRows(parsed.rows)
      const auto = detectUserColumnMapping(parsed.headers)
      setMapping(auto)
      const rows = mapUserRows(parsed.rows, auto)
      setPreview(rows.slice(0, 10))
      toast.success(`CSV cargado (${parsed.rows.length} filas)`)    
    } catch (e) {
      console.error(e)
      toast.error('No se pudo leer el CSV')
    }
  }

  const updateMapping = (key: keyof ColumnMapping, idx?: number) => {
    setMapping(prev => ({ ...prev, [key]: idx }))
    const rows = mapUserRows(rawRows, { ...mapping, [key]: idx })
    setPreview(rows.slice(0, 10))
  }

  const handleImport = async () => {
    if (!requiredFilled) {
      toast.error('Configura al menos Nombre y Email antes de importar')
      return
    }
    const rows = mapUserRows(rawRows, mapping)
    const invalid = rows.map(validateUserRow)
    const invalidCount = invalid.filter(arr => arr.length > 0).length
    if (invalidCount > 0) {
      toast.warning(`Hay ${invalidCount} filas con problemas. Se omitirán en la importación.`)
    }
    const validRows = rows.filter((_, i) => invalid[i].length === 0)
    setLoading(true)
    try {
      // Llama a API que realiza signUp y crea perfil
      const res = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: validRows })
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Error en importación')
      }
      toast.success(`Importación completada: ${json.imported} ok, ${json.failed} errores`)
      // reset state
      setHeaders([])
      setRawRows([])
      setPreview([])
      setMapping({})
      onOpenChange(false)
      await onImport(validRows)
    } catch (e) {
      console.error(e)
      toast.error('Falló la importación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar usuarios desde CSV</DialogTitle>
          <DialogDescription>
            Carga un archivo CSV, asigna columnas y revisa una vista previa antes de importar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              aria-label="Seleccionar archivo CSV"
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted/80"
            />
            {headers.length > 0 && (
              <Button variant="secondary" onClick={() => {
                setHeaders([]); setRawRows([]); setPreview([]); setMapping({})
              }}>Limpiar</Button>
            )}
          </div>

          {headers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldMap label="Nombre" value={mapping.name} headers={headers} onChange={(v) => updateMapping('name', v)} required />
              <FieldMap label="Email" value={mapping.email} headers={headers} onChange={(v) => updateMapping('email', v)} required />
              <FieldMap label="Rol" value={mapping.role} headers={headers} onChange={(v) => updateMapping('role', v)} />
              <FieldMap label="Estado" value={mapping.status} headers={headers} onChange={(v) => updateMapping('status', v)} />
            </div>
          )}

          {preview.length > 0 && (
            <div className="rounded-md border">
              <div className="p-2 text-sm text-muted-foreground">Vista previa (primeras 10 filas)</div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2">Nombre</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Rol</th>
                      <th className="text-left p-2">Estado</th>
                      <th className="text-left p-2">Validez</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => {
                      const issues = validateUserRow(r)
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.role || '-'}</td>
                          <td className="p-2">{r.status || '-'}</td>
                          <td className="p-2">
                            {issues.length === 0 ? (
                              <span className="text-green-600">OK</span>
                            ) : (
                              <span className="text-red-600">{issues.join(', ')}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!requiredFilled || loading}>
            {loading ? 'Importando…' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldMap({ label, required, headers, value, onChange }: {
  label: string
  required?: boolean
  headers: string[]
  value?: number
  onChange: (v?: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">
        {label} {required && <span className="text-red-600">*</span>}
      </div>
      <Select value={value !== undefined ? String(value) : undefined} onValueChange={(v) => onChange(v === 'undefined' ? undefined : Number(v))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecciona una columna" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="undefined">Sin asignar</SelectItem>
          {headers.map((h, idx) => (
            <SelectItem key={idx} value={String(idx)}>{h || `(Columna ${idx + 1})`}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}