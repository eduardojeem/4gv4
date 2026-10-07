'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  ShieldCheck,
  Truck,
  CreditCard,
  MessageCircle,
  Star,
  Award,
  Zap,
  Clock,
  Wrench,
  Package,
  MapPin,
  ThumbsUp,
  Sparkles,
  HeartHandshake,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  Loader2,
  RotateCcw,
  LucideIcon
} from 'lucide-react'
import type { TrustBarSettings, TrustBarItem } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { cn } from '@/lib/utils'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { STOREFRONT_STYLE_LABELS, type StorefrontStyle } from '@/lib/website/storefront-style'
import { TRUST_BAR_IDEAS, guidanceFamily } from '@/lib/website/vertical-guidance'

const ICON_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'truck', label: 'Envíos / Delivery', icon: Truck },
  { value: 'credit-card', label: 'Pagos / Cuotas', icon: CreditCard },
  { value: 'shield', label: 'Garantía / Seguridad', icon: ShieldCheck },
  { value: 'message', label: 'WhatsApp / Soporte', icon: MessageCircle },
  { value: 'star', label: 'Calidad / Destacado', icon: Star },
  { value: 'award', label: 'Oficial / Certificado', icon: Award },
  { value: 'zap', label: 'Rápido / Inmediato', icon: Zap },
  { value: 'clock', label: 'Horarios / Tiempo', icon: Clock },
  { value: 'wrench', label: 'Servicio Técnico', icon: Wrench },
  { value: 'package', label: 'Stock / Empaque', icon: Package },
  { value: 'map-pin', label: 'Sucursal / Local', icon: MapPin },
  { value: 'thumbs-up', label: 'Recomendado', icon: ThumbsUp },
  { value: 'sparkles', label: 'Novedades', icon: Sparkles },
  { value: 'handshake', label: 'Trato directo', icon: HeartHandshake },
  { value: 'check', label: 'Verificado', icon: CheckCircle2 },
]

let benefitSequence = 0
function newBenefitId() {
  benefitSequence += 1
  return `item-${Date.now()}-${benefitSequence}`
}

const POSITION_OPTIONS: Array<{ value: NonNullable<TrustBarSettings['position']>; label: string; description: string }> = [
  { value: 'above_carousel', label: 'Arriba de los banners', description: 'Apenas debajo de la portada.' },
  { value: 'below_carousel', label: 'Debajo de los banners', description: 'Antes de las categorías.' },
  { value: 'bottom', label: 'Al final', description: 'Antes del contacto y el pie de página.' },
]

export function TrustBarEditor({
  capabilities,
  storefrontStyle = 'classic',
}: {
  capabilities?: StorefrontCapabilities
  storefrontStyle?: StorefrontStyle
} = {}) {
  const { settings, isSaving, updateSetting } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults().trust_bar!
  const [draft, setDraft] = useState<TrustBarSettings | null>(null)
  const dirtyContext = useWebsiteEditorDirty()

  const current: TrustBarSettings = draft ?? settings?.trust_bar ?? defaults
  const hasChanges = draft !== null

  useEffect(() => {
    dirtyContext?.setDirty(hasChanges)
    return () => dirtyContext?.setDirty(false)
  }, [dirtyContext, hasChanges])

  const patch = <K extends keyof TrustBarSettings>(key: K, value: TrustBarSettings[K]) => {
    setDraft((prev) => ({ ...(prev ?? current), [key]: value }))
  }

  const updateItem = (index: number, partial: Partial<TrustBarItem>) => {
    const updated = [...current.items]
    updated[index] = { ...updated[index], ...partial }
    patch('items', updated)
  }

  const addItem = () => {
    if (current.items.length >= 6) {
      toast.error('Podés agregar hasta un máximo de 6 beneficios')
      return
    }
    const newItem: TrustBarItem = {
      id: newBenefitId(),
      icon: 'shield',
      title: 'Nuevo Beneficio',
      description: 'Descripción breve de tu servicio o garantía',
      active: true,
    }
    patch('items', [...current.items, newItem])
  }

  const removeItem = (index: number) => {
    if (current.items.length <= 1) {
      toast.error('Debe haber al menos 1 elemento configurado')
      return
    }
    const updated = current.items.filter((_, i) => i !== index)
    patch('items', updated)
  }

  // Ideas del rubro que todavía no están cargadas (se comparan por título).
  const family = capabilities ? guidanceFamily(capabilities) : 'general'
  const loadedTitles = new Set(current.items.map((item) => item.title.trim().toLowerCase()))
  const ideas = TRUST_BAR_IDEAS[family].filter((idea) => !loadedTitles.has(idea.title.toLowerCase()))

  const addIdea = (idea: (typeof ideas)[number]) => {
    if (current.items.length >= 6) {
      toast.error('Podés mostrar hasta 6 beneficios. Quitá uno para sumar otro.')
      return
    }
    patch('items', [...current.items, { ...idea, id: newBenefitId(), active: true }])
  }

  const applyVerticalIdeas = () => {
    if (!window.confirm('¿Reemplazar tus beneficios por los sugeridos para tu rubro? Podés descartar el cambio antes de guardar.')) return
    patch('items', TRUST_BAR_IDEAS[family].map((idea) => ({ ...idea, id: newBenefitId(), active: true })))
  }

  const restoreDefaults = () => {
    if (!window.confirm('¿Deseas restaurar los beneficios predeterminados?')) return
    setDraft({ ...defaults })
  }

  const handleSave = async () => {
    for (let i = 0; i < current.items.length; i++) {
      if (!current.items[i].title?.trim()) {
        toast.error(`El beneficio #${i + 1} debe tener un título`)
        return
      }
    }

    try {
      const res = await updateSetting('trust_bar', current)
      if (res?.success) {
        toast.success('¡Barra de beneficios guardada con éxito!')
        setDraft(null)
      } else {
        toast.error(res?.error || 'No se pudo guardar la barra de beneficios')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err as { message?: string } | null)?.message || 'Ocurrió un error al guardar'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Dónde se muestran"
        description="Una franja con pocas ventajas concretas, cerca del inicio de tu tienda."
        icon={ShieldCheck}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 p-3.5">
            <div>
              <Label htmlFor="trustbar-enabled" className="cursor-pointer text-sm font-semibold text-foreground">
                Mostrar beneficios en el inicio
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Si la apagás, tus beneficios se guardan pero no se ven.
              </p>
            </div>
            <Switch
              id="trustbar-enabled"
              checked={current.enabled !== false}
              onCheckedChange={(checked) => patch('enabled', checked)}
            />
          </div>

          {storefrontStyle === 'classic' ? (
            <div role="radiogroup" aria-label="Ubicación en el inicio" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {POSITION_OPTIONS.map((option) => {
                const selected = (current.position ?? 'above_carousel') === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch('position', option.value)}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors',
                      selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border/80 hover:bg-muted/50'
                    )}
                  >
                    <span className="text-xs font-semibold text-foreground">{option.label}</span>
                    <span className="text-[11px] leading-tight text-muted-foreground">{option.description}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed px-3.5 py-2.5 text-xs text-muted-foreground">
              Tu plantilla <strong className="text-foreground">{STOREFRONT_STYLE_LABELS[storefrontStyle]}</strong> los ubica sola, debajo de la portada.
            </p>
          )}
        </div>
      </SectionCard>

      {ideas.length > 0 && (
        <section aria-labelledby="trustbar-ideas" className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 id="trustbar-ideas" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                Ideas{capabilities ? ` para ${capabilities.businessLabel.toLowerCase()}` : ''}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Tocá una para sumarla. Usá solo las que cumplís de verdad.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={applyVerticalIdeas} className="text-xs">
              Usar todas
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ideas.map((idea) => {
              const IdeaIcon = ICON_OPTIONS.find((option) => option.value === idea.icon)?.icon ?? ShieldCheck
              return (
                <button
                  key={idea.title}
                  type="button"
                  onClick={() => addIdea(idea)}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <IdeaIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  {idea.title}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Vista previa con el mismo componente que usa la tienda. */}
      <section aria-label="Vista previa de los beneficios" className="overflow-hidden rounded-2xl border">
        <p className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">Así se ve en tu tienda</p>
        {current.enabled !== false && current.items.some((item) => item.active !== false && item.title.trim()) ? (
          <div className="pointer-events-none bg-background" aria-hidden="true">
            <StoreTrustBar settings={current} className="py-4" />
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">{current.enabled === false ? 'Oculta: tus clientes no la ven.' : 'Activá al menos un beneficio para verla.'}</p>
        )}
      </section>

      {/* ── Editor de Tarjetas de Beneficios ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Tus beneficios <span className="text-muted-foreground">({current.items.length}/6)</span></h3>
            <p className="text-xs text-muted-foreground">Recomendamos 3 o 4: título corto y una línea que lo explique.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={restoreDefaults}
              className="text-xs font-semibold gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Restaurar</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={addItem}
              disabled={current.items.length >= 6}
              className="font-bold gap-1.5 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Agregar</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {current.items.map((item, index) => {
            const SelectedIcon =
              (item.icon && ICON_OPTIONS.find((o) => o.value === item.icon.toLowerCase())?.icon) ||
              ShieldCheck

            return (
              <div
                key={item.id || index}
                className={cn(
                  'rounded-2xl border p-4 transition-all duration-200 bg-card space-y-3.5 shadow-2xs',
                  item.active !== false ? 'border-border/90' : 'border-border/50 opacity-60 bg-muted/20'
                )}
              >
                {/* Header de la Tarjeta */}
                <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <SelectedIcon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-foreground">Beneficio #{index + 1}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`item-active-${index}`} className="text-[11px] text-muted-foreground cursor-pointer">
                        {item.active !== false ? 'Activo' : 'Oculto'}
                      </Label>
                      <Switch
                        id={`item-active-${index}`}
                        checked={item.active !== false}
                        onCheckedChange={(checked) => updateItem(index, { active: checked })}
                      />
                    </div>

                    {current.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded-md"
                        title="Eliminar tarjeta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Campos de Título y Descripción */}
                <div className="space-y-2.5">
                  <div>
                    <Label htmlFor={`item-title-${index}`} className="text-xs font-semibold text-foreground">
                      Título
                    </Label>
                    <Input
                      id={`item-title-${index}`}
                      value={item.title}
                      onChange={(e) => updateItem(index, { title: e.target.value })}
                      placeholder="Ej: Envíos Rápidos, Compra Protegida"
                      className="mt-1 h-9 text-xs font-bold"
                      maxLength={60}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`item-desc-${index}`} className="text-xs font-semibold text-foreground">
                      Descripción
                    </Label>
                    <Input
                      id={`item-desc-${index}`}
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      placeholder="Ej: A domicilio o retiro en tienda"
                      className="mt-1 h-9 text-xs"
                      maxLength={100}
                    />
                  </div>

                  {/* Selector de Icono */}
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Icono</Label>
                    <div className="mt-1.5 grid grid-cols-8 gap-1">
                      {ICON_OPTIONS.map((opt) => {
                        const OptIcon = opt.icon
                        const isSelected = (item.icon || 'shield').toLowerCase() === opt.value

                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateItem(index, { icon: opt.value })}
                            title={opt.label}
                            aria-label={opt.label}
                            aria-pressed={isSelected}
                            className={cn(
                              'flex h-8 items-center justify-center rounded-lg border transition-colors cursor-pointer',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                : 'border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <OptIcon className="h-4 w-4" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Botón Flotante / Inferior de Guardar ── */}
      <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border bg-background/95 p-3 sm:p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full shrink-0',
              hasChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            )}
            aria-hidden="true"
          />
          <span className="font-semibold text-foreground">
            {hasChanges ? 'Hay cambios sin guardar' : 'Beneficios guardados'}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(null)}
              className="h-10 px-4 rounded-xl text-xs font-semibold flex-1 sm:flex-none"
            >
              Descartar
            </Button>
          )}
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasChanges}
            className="h-10 px-5 rounded-xl text-xs font-bold gap-2 flex-1 sm:flex-none"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Guardar beneficios</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
