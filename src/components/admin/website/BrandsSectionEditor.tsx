'use client'

import { useEffect, useState, useRef } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Tag,
  Plus,
  Trash2,
  Save,
  Loader2,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  X,
  Link as LinkIcon,
} from 'lucide-react'
import type { BrandsSectionSettings, BrandItemSettings } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { POPULAR_PRESET_BRANDS, getBrandLogoOrFallback } from '@/lib/website/brand-catalog'
import { cn } from '@/lib/utils'

export function BrandsSectionEditor() {
  const { settings, isSaving, updateSetting } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults().brands_section!
  const [draft, setDraft] = useState<BrandsSectionSettings | null>(null)
  
  // Estado para nueva marca personalizada
  const [customBrandName, setCustomBrandName] = useState('')
  const [customBrandLogoUrl, setCustomBrandLogoUrl] = useState('')
  const [isUploadingNewLogo, setIsUploadingNewLogo] = useState(false)
  const newLogoFileInputRef = useRef<HTMLInputElement>(null)

  // Estado para editar logo de marca existente
  const [editingLogoIndex, setEditingLogoIndex] = useState<number | null>(null)
  const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null)
  const itemFileInputRef = useRef<HTMLInputElement>(null)

  const dirtyContext = useWebsiteEditorDirty()

  const current: BrandsSectionSettings = draft ?? settings?.brands_section ?? defaults
  const hasChanges = draft !== null

  useEffect(() => {
    dirtyContext?.setDirty(hasChanges)
    return () => dirtyContext?.setDirty(false)
  }, [dirtyContext, hasChanges])

  const patch = <K extends keyof BrandsSectionSettings>(key: K, value: BrandsSectionSettings[K]) => {
    setDraft((prev) => ({ ...(prev ?? current), [key]: value }))
  }

  const updateItem = (index: number, partial: Partial<BrandItemSettings>) => {
    const updated = [...current.items]
    updated[index] = { ...updated[index], ...partial }
    patch('items', updated)
  }

  const moveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= current.items.length) return
    const updated = [...current.items]
    const [moved] = updated.splice(index, 1)
    updated.splice(target, 0, moved)
    patch('items', updated)
  }

  const removeItem = (index: number) => {
    const updated = current.items.filter((_, i) => i !== index)
    patch('items', updated)
  }

  const uploadLogoFile = async (file: File, brandId: string): Promise<string | null> => {
    if (!file) return null
    if (!file.type.startsWith('image/')) {
      toast.error('Seleccioná un archivo de imagen válido (PNG, JPG, SVG, WebP)')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo de imagen no puede superar 5 MB')
      return null
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('brandId', brandId)

    try {
      const res = await fetch('/api/admin/website/brand-logo', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || 'No se pudo subir la imagen')
      }
      return data.url
    } catch (err: any) {
      toast.error(err?.message || 'Error al subir el logo')
      return null
    }
  }

  const handleUploadNewBrandLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingNewLogo(true)
    const url = await uploadLogoFile(file, `custom-${Date.now()}`)
    setIsUploadingNewLogo(false)
    if (url) {
      setCustomBrandLogoUrl(url)
      toast.success('Logo subido con éxito')
    }
    if (newLogoFileInputRef.current) {
      newLogoFileInputRef.current.value = ''
    }
  }

  const handleUploadItemLogo = async (index: number, file: File) => {
    const item = current.items[index]
    if (!item || !file) return
    setUploadingItemIndex(index)
    const url = await uploadLogoFile(file, item.id || `brand-${index}`)
    setUploadingItemIndex(null)
    if (url) {
      updateItem(index, { imageUrl: url })
      toast.success(`Logo para ${item.name} actualizado`)
    }
  }

  const addPresetBrand = (preset: typeof POPULAR_PRESET_BRANDS[number]) => {
    const exists = current.items.some(
      (item) => item.name.toLowerCase() === preset.name.toLowerCase() || item.id === preset.id
    )
    if (exists) {
      toast.info(`La marca ${preset.name} ya está en tu lista`)
      return
    }
    const newItem: BrandItemSettings = {
      id: preset.id,
      name: preset.name,
      active: true,
    }
    patch('items', [...current.items, newItem])
    toast.success(`Marca ${preset.name} agregada`)
  }

  const addCustomBrand = () => {
    const trimmed = customBrandName.trim()
    if (!trimmed) {
      toast.error('Ingresá el nombre de la marca')
      return
    }
    const slug = trimmed.toLowerCase().replace(/\s+/g, '-')
    const exists = current.items.some(
      (item) => item.name.toLowerCase() === trimmed.toLowerCase() || item.id === slug
    )
    if (exists) {
      toast.info(`La marca ${trimmed} ya está en la lista`)
      return
    }
    const newItem: BrandItemSettings = {
      id: `brand-${Date.now()}`,
      name: trimmed,
      active: true,
      imageUrl: customBrandLogoUrl.trim() || undefined,
    }
    patch('items', [...current.items, newItem])
    setCustomBrandName('')
    setCustomBrandLogoUrl('')
    toast.success(`Marca ${trimmed} agregada`)
  }

  const restoreDefaults = () => {
    if (!window.confirm('¿Deseás restaurar las marcas predeterminadas?')) return
    setDraft({ ...defaults })
  }

  const handleSave = async () => {
    for (let i = 0; i < current.items.length; i++) {
      if (!current.items[i].name?.trim()) {
        toast.error(`La marca #${i + 1} debe tener un nombre válido`)
        return
      }
    }

    try {
      const res = await updateSetting('brands_section', current)
      if (res?.success) {
        toast.success('¡Sección de marcas guardada con éxito!')
        setDraft(null)
      } else {
        toast.error(res?.error || 'No se pudo guardar la sección de marcas')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Ocurrió un error al guardar')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Tarjeta de Control Principal ── */}
      <SectionCard
        title="Marquesina de Marcas Destacadas"
        description="Seleccioná qué marcas exhibir en la portada de tu tienda con movimiento animado continuo, agregá tus marcas y subí logos personalizados."
        icon={Tag}
      >
        <div className="space-y-6">
          {/* Switch de Visibilidad General */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-muted/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Mostrar sección en la tienda</span>
                <span
                  className={cn(
                    'px-2 py-0.5 text-[11px] font-bold rounded-full',
                    current.enabled
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border'
                  )}
                >
                  {current.enabled ? 'Visible al público' : 'Oculta'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Al desactivarla, la cinta de logotipos no se mostrará a los clientes en la página de inicio.
              </p>
            </div>
            <Switch
              checked={current.enabled}
              onCheckedChange={(val) => patch('enabled', val)}
              aria-label="Activar sección de marcas"
            />
          </div>

          {/* Título y Subtítulo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brands-title" className="text-xs font-semibold">
                Título de la sección
              </Label>
              <Input
                id="brands-title"
                value={current.title}
                onChange={(e) => patch('title', e.target.value)}
                placeholder="Las mejores marcas para toda la familia"
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brands-subtitle" className="text-xs font-semibold">
                Subtítulo o descripción breve
              </Label>
              <Input
                id="brands-subtitle"
                value={current.subtitle || ''}
                onChange={(e) => patch('subtitle', e.target.value)}
                placeholder="Encontrá indumentaria y calzado original con garantía y envío rápido"
                className="h-10 text-sm"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Marcas Populares Sugeridas ── */}
      <SectionCard
        title="Catálogo de Marcas Disponibles"
        description="Hacé clic en una marca para sumarla directamente a la marquesina de tu tienda."
        icon={Sparkles}
      >
        <div className="flex flex-wrap gap-2.5">
          {POPULAR_PRESET_BRANDS.map((preset) => {
            const alreadyInList = current.items.some(
              (item) => item.name.toLowerCase() === preset.name.toLowerCase() || item.id === preset.id
            )
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => addPresetBrand(preset)}
                disabled={alreadyInList}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                  alreadyInList
                    ? 'bg-muted/50 text-muted-foreground border-border/40 cursor-not-allowed opacity-60'
                    : 'bg-card hover:bg-primary/5 hover:border-primary text-foreground shadow-xs cursor-pointer active:scale-95'
                )}
              >
                <span className="h-4 w-auto flex items-center text-foreground">{preset.svgLogo}</span>
                <span>{preset.name}</span>
                {alreadyInList ? (
                  <span className="text-[10px] text-muted-foreground font-normal">(agregada)</span>
                ) : (
                  <Plus className="h-3.5 w-3.5 text-primary ml-1" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Agregar marca personalizada con Logo ── */}
        <div className="mt-6 pt-5 border-t border-border/60 space-y-3">
          <Label className="text-xs font-bold block text-foreground">
            ¿Vendés otra marca que no esté arriba? Agregala con su logo propio:
          </Label>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Nombre */}
            <div className="sm:col-span-4 space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Nombre de la marca</span>
              <Input
                id="custom-brand-input"
                value={customBrandName}
                onChange={(e) => setCustomBrandName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomBrand()
                  }
                }}
                placeholder="Ej: Lacoste, Topper, Tommy..."
                className="h-10 text-sm"
              />
            </div>

            {/* Logo URL o Subida */}
            <div className="sm:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Logo de la marca (opcional)</span>
                {customBrandLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setCustomBrandLogoUrl('')}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    Quitar logo
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customBrandLogoUrl}
                  onChange={(e) => setCustomBrandLogoUrl(e.target.value)}
                  placeholder="URL del logo (https://...)"
                  className="h-10 text-xs"
                />
                <input
                  ref={newLogoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleUploadNewBrandLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => newLogoFileInputRef.current?.click()}
                  disabled={isUploadingNewLogo}
                  title="Subir archivo de logo"
                >
                  {isUploadingNewLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Previsualización del Logo y Botón Agregar */}
            <div className="sm:col-span-3 flex items-center gap-2">
              {customBrandLogoUrl ? (
                <div className="h-10 w-12 shrink-0 rounded-lg border border-border/60 bg-muted/30 p-1 flex items-center justify-center">
                  <img
                    src={customBrandLogoUrl}
                    alt="Logo preview"
                    className="max-h-7 max-w-full object-contain"
                    onError={() => toast.error('La URL del logo no parece ser una imagen válida')}
                  />
                </div>
              ) : null}
              <Button
                type="button"
                onClick={addCustomBrand}
                className="w-full h-10 font-bold text-xs gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Agregar Marca
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Lista de Marcas Configuradas ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Marcas en tu marquesina ({current.items.length})</h3>
            <p className="text-xs text-muted-foreground">
              Activá o desactivá la opción <strong>Público</strong> para elegir exactamente qué marcas ven los clientes, y cambiá su logo cuando quieras.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={restoreDefaults}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restaurar sugeridas
          </Button>
        </div>

        {current.items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10">
            <p className="text-sm font-semibold text-muted-foreground">No tenés ninguna marca agregada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Elegí alguna de las marcas populares sugeridas arriba o ingresá una marca personalizada.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {current.items.map((item, index) => {
              const presetLogo = getBrandLogoOrFallback(item.id) || getBrandLogoOrFallback(item.name)
              const hasCustomImage = Boolean(item.imageUrl)
              const isEditingThisLogo = editingLogoIndex === index

              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-3.5 rounded-xl border bg-card shadow-2xs transition-all space-y-3',
                    item.active
                      ? 'border-border/80'
                      : 'border-border/40 bg-muted/20 opacity-75'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Logotipo y Nombre */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 p-1 text-foreground overflow-hidden">
                        {hasCustomImage ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="max-h-8 max-w-full object-contain"
                          />
                        ) : presetLogo ? (
                          <div className="max-h-6 max-w-full flex items-center justify-center">
                            {presetLogo}
                          </div>
                        ) : (
                          <span className="font-bold text-[11px] uppercase tracking-tighter truncate">
                            {item.name.slice(0, 4)}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-md',
                              item.active
                                ? 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-400'
                                : 'text-muted-foreground bg-muted'
                            )}
                          >
                            {item.active ? (
                              <>
                                <Eye className="h-3 w-3" /> Público
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3 w-3" /> Oculto
                              </>
                            )}
                          </span>

                          {hasCustomImage && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                              • Logo propio
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones principales: Switch público y Reordenar */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 mr-1">
                        <span className="text-xs font-semibold text-muted-foreground">Público:</span>
                        <Switch
                          checked={item.active}
                          onCheckedChange={(val) => updateItem(index, { active: val })}
                          aria-label={`Marca ${item.name} pública`}
                        />
                      </div>

                      <div className="flex items-center gap-0.5 border-l pl-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveItem(index, -1)}
                          disabled={index === 0}
                          className="h-8 w-8 text-muted-foreground"
                          title="Mover antes"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveItem(index, 1)}
                          disabled={index === current.items.length - 1}
                          className="h-8 w-8 text-muted-foreground"
                          title="Mover después"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Eliminar marca"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Fila secundaria: Edición del Logo de esta marca */}
                  <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingLogoIndex(isEditingThisLogo ? null : index)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <ImageIcon className="h-3 w-3" />
                      {hasCustomImage ? 'Cambiar logo de la marca' : 'Asignar logo / imagen'}
                    </button>

                    {hasCustomImage && (
                      <button
                        type="button"
                        onClick={() => updateItem(index, { imageUrl: undefined })}
                        className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Quitar logo propio
                      </button>
                    )}
                  </div>

                  {/* Panel expandible para editar logo de la marca */}
                  {isEditingThisLogo && (
                    <div className="p-2.5 rounded-lg border bg-muted/30 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                        <span>Ingresá URL o subí archivo de imagen (PNG, SVG, JPG)</span>
                        <button
                          type="button"
                          onClick={() => setEditingLogoIndex(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <Input
                          value={item.imageUrl || ''}
                          onChange={(e) => updateItem(index, { imageUrl: e.target.value.trim() || undefined })}
                          placeholder="https://.../logo.png"
                          className="h-8 text-xs"
                        />
                        <label className="shrink-0 cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) handleUploadItemLogo(index, f)
                              e.target.value = ''
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 px-2.5 text-xs gap-1 pointer-events-none"
                            disabled={uploadingItemIndex === index}
                          >
                            {uploadingItemIndex === index ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            Subir
                          </Button>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Barra Flotante de Guardar ── */}
      <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border bg-background/95 p-3.5 sm:p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full shrink-0',
              hasChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            )}
            aria-hidden="true"
          />
          <span className="font-semibold text-foreground">
            {hasChanges ? 'Hay cambios sin guardar en las marcas' : 'Marcas guardadas y sincronizadas'}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(null)}
              className="h-10 px-4 rounded-xl text-xs font-semibold"
            >
              Descartar
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="h-10 px-5 rounded-xl text-xs font-bold gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar cambios
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
