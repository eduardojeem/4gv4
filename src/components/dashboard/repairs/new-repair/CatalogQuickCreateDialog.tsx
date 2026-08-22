'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, PackagePlus, Wrench } from 'lucide-react'
import { branchHeaders } from '@/lib/branches/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  parseCatalogQuickCreateInput,
  toProductCreatePayload,
  type CatalogQuickCreateInput,
} from './catalog-quick-create'
import type { CatalogItemKind, RepairCatalogItem } from './types'

interface CategoryOption { id: string; name: string }

interface CatalogQuickCreateDialogProps {
  open: boolean
  kind: CatalogItemKind
  branchId: string
  canCreate: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (product: RepairCatalogItem) => void
}

interface ApiResponse {
  success?: boolean
  data?: RepairCatalogItem
  error?: string
  details?: Array<{ field?: string; message?: string }>
}

const initialValues = {
  name: '', sku: '', salePrice: '', wholesalePrice: '', purchasePrice: '',
  initialStock: '0', categoryId: '',
}

export function CatalogQuickCreateDialog({
  open,
  kind,
  branchId,
  canCreate,
  onOpenChange,
  onCreated,
}: CatalogQuickCreateDialogProps) {
  const [values, setValues] = useState(initialValues)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setValues(initialValues)
    setFieldErrors({})
    setRequestError(null)
    const controller = new AbortController()
    void fetch('/api/categories?is_active=true', {
      cache: 'no-store',
      headers: branchHeaders(branchId),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => setCategories(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setCategories([]))
    return () => controller.abort()
  }, [branchId, kind, open])

  const label = kind === 'service' ? 'servicio' : 'repuesto'

  const updateValue = (field: keyof typeof initialValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canCreate || submitting) return

    const candidate = {
      kind,
      name: values.name,
      sku: values.sku,
      salePrice: Number(values.salePrice),
      wholesalePrice: values.wholesalePrice ? Number(values.wholesalePrice) : null,
      purchasePrice: Number(values.purchasePrice),
      categoryId: values.categoryId || null,
      ...(kind === 'part' ? { initialStock: Number(values.initialStock) } : {}),
    }
    const parsed = parseCatalogQuickCreateInput(candidate)
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] = issue.message
      setFieldErrors(nextErrors)
      nameRef.current?.focus()
      return
    }

    setSubmitting(true)
    setRequestError(null)
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(branchId) },
        body: JSON.stringify(toProductCreatePayload(parsed.data as CatalogQuickCreateInput, branchId)),
      })
      const payload = await response.json().catch(() => ({})) as ApiResponse
      if (!response.ok || !payload.success || !payload.data) {
        if (payload.details?.length) {
          setFieldErrors(Object.fromEntries(payload.details.flatMap((detail) =>
            detail.field && detail.message ? [[detail.field, detail.message]] : []
          )))
        }
        throw new Error(payload.error || `No se pudo crear el ${label}.`)
      }
      onCreated(payload.data)
      onOpenChange(false)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : `No se pudo crear el ${label}.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === 'service' ? <Wrench className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}
            Crear {label} en el catálogo
          </DialogTitle>
          <DialogDescription>
            Quedará disponible para esta reparación y para las próximas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!canCreate && (
            <div role="alert" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              No tenés permiso para crear artículos en el catálogo.
            </div>
          )}
          {requestError && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {requestError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="catalog-item-name">Nombre del {label}</Label>
              <Input ref={nameRef} id="catalog-item-name" value={values.name} onChange={(e) => updateValue('name', e.target.value)} aria-invalid={Boolean(fieldErrors.name)} />
              {fieldErrors.name && <p className="text-sm text-red-600">{fieldErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-item-sku">SKU (opcional)</Label>
              <Input id="catalog-item-sku" value={values.sku} onChange={(e) => updateValue('sku', e.target.value)} placeholder="Se genera automáticamente" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-item-category">Categoría (opcional)</Label>
              <select id="catalog-item-category" value={values.categoryId} onChange={(e) => updateValue('categoryId', e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Sin categoría</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-sale-price">Precio de venta</Label>
              <Input id="catalog-sale-price" inputMode="numeric" value={values.salePrice} onChange={(e) => updateValue('salePrice', e.target.value)} aria-invalid={Boolean(fieldErrors.salePrice)} />
              {fieldErrors.salePrice && <p className="text-sm text-red-600">{fieldErrors.salePrice}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-wholesale-price">Precio mayorista (opcional)</Label>
              <Input id="catalog-wholesale-price" inputMode="numeric" value={values.wholesalePrice} onChange={(e) => updateValue('wholesalePrice', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-purchase-price">Costo interno</Label>
              <Input id="catalog-purchase-price" inputMode="numeric" value={values.purchasePrice} onChange={(e) => updateValue('purchasePrice', e.target.value)} aria-invalid={Boolean(fieldErrors.purchasePrice)} />
              {fieldErrors.purchasePrice && <p className="text-sm text-red-600">{fieldErrors.purchasePrice}</p>}
            </div>
            {kind === 'part' && (
              <div className="space-y-2">
                <Label htmlFor="catalog-initial-stock">Stock inicial en esta sucursal</Label>
                <Input id="catalog-initial-stock" inputMode="numeric" value={values.initialStock} onChange={(e) => updateValue('initialStock', e.target.value)} aria-invalid={Boolean(fieldErrors.initialStock)} />
                {fieldErrors.initialStock && <p className="text-sm text-red-600">{fieldErrors.initialStock}</p>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!canCreate || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear {label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
