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

export function TrustBarEditor() {
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
      id: `item-${Date.now()}`,
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
    } catch (err: any) {
      toast.error(err?.message || 'Ocurrió un error al guardar')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Tarjeta de Control Principal ── */}
      <SectionCard
        title="Barra de Beneficios y Confianza"
        description="Configurá las tarjetas de beneficios comerciales que ven los clientes en tu portada."
        icon={ShieldCheck}
      >
        <div className="space-y-6">
          {/* Switch de Visibilidad */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl border bg-muted/20">
            <div>
              <Label htmlFor="trustbar-enabled" className="text-sm font-bold text-foreground cursor-pointer">
                Mostrar barra de beneficios en la portada
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Al desactivarlo, la sección completa se oculta de la página de inicio.
              </p>
            </div>
            <Switch
              id="trustbar-enabled"
              checked={current.enabled !== false}
              onCheckedChange={(checked) => patch('enabled', checked)}
            />
          </div>

          {/* Selector de Ubicación / Posición */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-bold text-foreground">Ubicación en la página de inicio</Label>
              <p className="text-xs text-muted-foreground">Elegí dónde querés que se muestren los beneficios de compra.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => patch('position', 'above_carousel')}
                className={cn(
                  'flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                  current.position === 'above_carousel' || !current.position
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border/80 hover:bg-muted/50'
                )}
              >
                <span className="text-xs font-bold text-foreground">⬆️ Arriba del Carrusel</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Ubicado inmediatamente debajo del Hero de portada y antes del banner promocional.
                </span>
              </button>

              <button
                type="button"
                onClick={() => patch('position', 'below_carousel')}
                className={cn(
                  'flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                  current.position === 'below_carousel'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border/80 hover:bg-muted/50'
                )}
              >
                <span className="text-xs font-bold text-foreground">⬇️ Debajo del Carrusel</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Ubicado justo después del carrusel promocional y antes de las categorías.
                </span>
              </button>

              <button
                type="button"
                onClick={() => patch('position', 'bottom')}
                className={cn(
                  'flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                  current.position === 'bottom'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border/80 hover:bg-muted/50'
                )}
              >
                <span className="text-xs font-bold text-foreground">📍 Al Pie de Página</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Ubicado en la parte inferior, antes del centro de contacto y footer.
                </span>
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Editor de Tarjetas de Beneficios ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Tarjetas de Beneficios</h3>
            <p className="text-xs text-muted-foreground">Personalizá los textos, iconos y visibilidad de cada tarjeta ({current.items.length}/6).</p>
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
              <span>Predeterminados</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={addItem}
              disabled={current.items.length >= 6}
              className="font-bold gap-1.5 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Agregar beneficio</span>
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
                    <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                      {ICON_OPTIONS.map((opt) => {
                        const OptIcon = opt.icon
                        const isSelected = (item.icon || 'shield').toLowerCase() === opt.value

                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateItem(index, { icon: opt.value })}
                            title={opt.label}
                            className={cn(
                              'flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-medium transition-all cursor-pointer gap-1',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-xs font-bold'
                                : 'border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <OptIcon className="h-4 w-4" />
                            <span className="truncate max-w-full text-[9px]">{opt.label.split('/')[0].trim()}</span>
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
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 md:sticky md:bottom-6 md:justify-end">
        {hasChanges && (
          <Button type="button" variant="outline" onClick={() => setDraft(null)}>
            Descartar
          </Button>
        )}
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || !hasChanges}
          size="lg"
          className="font-bold shadow-lg gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar beneficios
        </Button>
      </div>
    </div>
  )
}
