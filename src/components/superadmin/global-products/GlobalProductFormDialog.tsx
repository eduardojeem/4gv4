'use client'

import { useState } from 'react'
import { Barcode, CheckCircle2, ImageOff, Info, Layers, Loader2, Sparkles, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

export type GlobalProductDraft = {
  id?: string
  gtin: string
  name: string
  brand_name: string
  global_brand_id: string
  global_category_id: string
  description: string
  image_url: string
  is_active: boolean
}

type Option = { id: string; name: string; parent_id?: string | null; sort_order?: number | null }

interface GlobalProductFormDialogProps {
  open: boolean
  draft: GlobalProductDraft | null
  saving: boolean
  brands: Option[]
  categoryOptions: Option[]
  categoryName: Map<string, string>
  onClose: () => void
  onSave: (draft: GlobalProductDraft) => Promise<void>
}

export function GlobalProductFormDialog({
  open,
  draft,
  saving,
  brands,
  categoryOptions,
  categoryName,
  onClose,
  onSave,
}: GlobalProductFormDialogProps) {
  const [current, setCurrent] = useState<GlobalProductDraft | null>(draft)

  // Sincronizar draft cuando cambia
  if (draft && (!current || current.id !== draft.id || (draft.id === undefined && current.gtin === '' && draft.gtin !== ''))) {
    setCurrent(draft)
  }

  if (!draft || !current) return null

  const cleanGtin = current.gtin.trim().replace(/\D/g, '')
  const isStandardGtin = [8, 12, 13, 14].includes(cleanGtin.length)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!current.gtin.trim() || !current.name.trim()) return
    void onSave(current)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !saving && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-2xl border-border shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10 backdrop-blur-md">
                  <Barcode className="h-5 w-5 text-sky-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">
                    {current.id ? 'Editar Ficha Global de Producto' : 'Nueva Ficha Oficial por Código de Barras'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-300 mt-0.5">
                    Al escanear este código, cualquier tienda recibirá estos datos autocompletados.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Código y Nombre */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gp-gtin" className="text-xs font-bold text-foreground">Código de Barras *</Label>
                  {cleanGtin.length > 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {cleanGtin.length} díg.
                    </span>
                  )}
                </div>
                <Input
                  id="gp-gtin"
                  inputMode="numeric"
                  value={current.gtin}
                  onChange={(e) => setCurrent({ ...current, gtin: e.target.value })}
                  placeholder="7891000315507"
                  className="font-mono text-sm tracking-wider rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gp-name" className="text-xs font-bold text-foreground">Nombre Comercial del Producto *</Label>
                <Input
                  id="gp-name"
                  value={current.name}
                  onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                  placeholder="Ej: Nescafé Tradición Frasco 170 g"
                  className="rounded-xl font-medium"
                  required
                />
              </div>
            </div>

            {/* Clasificación: Marca y Categoría */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="gp-brand" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  Marca Oficial del Catálogo
                </Label>
                <select
                  id="gp-brand"
                  value={current.global_brand_id}
                  onChange={(e) => setCurrent({ ...current, global_brand_id: e.target.value })}
                  className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">(Sin marca global vinculada)</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gp-category" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  Categoría Global
                </Label>
                <select
                  id="gp-category"
                  value={current.global_category_id}
                  onChange={(e) => setCurrent({ ...current, global_category_id: e.target.value })}
                  className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">(Sin categoría asignada)</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {categoryName.get(cat.id) || cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Marca en texto si no está en global_brands */}
            {!current.global_brand_id && (
              <div className="space-y-1.5 bg-muted/40 p-3 rounded-xl border border-dashed">
                <Label htmlFor="gp-brand-name" className="text-xs font-semibold text-muted-foreground">
                  Marca en texto libre (opcional)
                </Label>
                <Input
                  id="gp-brand-name"
                  value={current.brand_name}
                  onChange={(e) => setCurrent({ ...current, brand_name: e.target.value })}
                  placeholder="Ej: Nestlé (si aún no creaste la marca en Catálogo de Marcas)"
                  className="rounded-lg h-8 text-xs bg-background"
                />
              </div>
            )}

            {/* Foto e Imagen */}
            <div className="space-y-2 pt-1">
              <Label htmlFor="gp-image" className="text-xs font-bold text-foreground">
                Fotografía Oficial del Producto
              </Label>
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 shrink-0 rounded-xl border bg-white p-1 shadow-xs flex items-center justify-center overflow-hidden">
                  {current.image_url.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={current.image_url.trim()}
                      alt="Vista previa"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageOff className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    id="gp-image"
                    value={current.image_url}
                    onChange={(e) => setCurrent({ ...current, image_url: e.target.value })}
                    placeholder="https://.../storage/v1/object/public/product-images/..."
                    className="text-xs font-mono rounded-xl h-9"
                  />
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    URL pública de Supabase Storage o CDN permitida de la plataforma.
                  </p>
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="gp-desc" className="text-xs font-bold text-foreground">
                  Descripción del Producto
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  {current.description.length}/2000
                </span>
              </div>
              <Textarea
                id="gp-desc"
                rows={3}
                value={current.description}
                onChange={(e) => setCurrent({ ...current, description: e.target.value })}
                placeholder="Detalles sobre presentación, peso neto, ingredientes o especificaciones técnicas..."
                className="text-xs rounded-xl resize-none"
              />
            </div>

            {/* Estado de activación */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="gp-active" className="text-xs font-bold text-foreground cursor-pointer">
                  Ficha activa en catálogo global
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Si está desactivada, el lector no sugerirá estos datos al escanear.
                </p>
              </div>
              <input
                id="gp-active"
                type="checkbox"
                checked={current.is_active}
                onChange={(e) => setCurrent({ ...current, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t bg-muted/20 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !current.gtin.trim() || !current.name.trim()}
              className="rounded-xl gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {current.id ? 'Guardar Cambios' : 'Agregar al Catálogo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
