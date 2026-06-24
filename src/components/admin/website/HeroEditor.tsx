'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, Save, Sparkles, TrendingUp, Check, Eye } from 'lucide-react'
import { HeroContent, HeroStats } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getBrandTheme } from '@/lib/constants/brand-theme'

export function HeroEditor() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults()
  const [heroContentDraft, setHeroContentDraft] = useState<HeroContent | null>(null)
  const [heroStatsDraft, setHeroStatsDraft] = useState<HeroStats | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const heroContent = heroContentDraft ?? settings?.hero_content ?? defaults.hero_content
  const heroStats = heroStatsDraft ?? settings?.hero_stats ?? defaults.hero_stats
  const hasChanges = heroContentDraft !== null || heroStatsDraft !== null

  const brand = getBrandTheme(settings?.company_info?.brandColor)
  const customBrandStyle =
    settings?.company_info?.brandColor === 'custom' && settings.company_info.customBrandColor
      ? { '--primary': settings.company_info.customBrandColor } as React.CSSProperties
      : undefined

  // Report unsaved changes so the tabs page can warn before switching away.
  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  const updateContent = (field: keyof HeroContent, value: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    setHeroContentDraft((c) => ({ ...(c ?? heroContent), [field]: value }))
  }

  const updateStat = (field: keyof HeroStats, value: string) => {
    setHeroStatsDraft((s) => ({ ...(s ?? heroStats), [field]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasChanges) return

    const nextErrors: Record<string, string> = {}
    if (!heroContent.title || heroContent.title.trim().length < 3) {
      nextErrors.title = 'El título debe tener al menos 3 caracteres.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      toast.error('Revisá los campos marcados')
      return
    }
    setErrors({})

    const tasks: Promise<{ success: boolean; error?: string }>[] = []
    if (heroContentDraft !== null) tasks.push(updateSetting('hero_content', heroContent))
    if (heroStatsDraft !== null) tasks.push(updateSetting('hero_stats', heroStats))

    const results = await Promise.all(tasks)
    const failed = results.find((r) => !r.success)

    if (failed) {
      toast.error(failed.error || 'Error al guardar')
      return
    }

    toast.success('Hero actualizado', { icon: <Check className="h-4 w-4" /> })
    setHeroContentDraft(null)
    setHeroStatsDraft(null)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando contenido...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-destructive">
        Error al cargar contenido: {error}
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 pb-24 md:pb-6">
      {/* Live preview */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            Vista previa
          </span>
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        </div>
        <div
          className={`relative overflow-hidden bg-gradient-to-br ${brand.hero} px-6 py-10 text-white`}
          style={customBrandStyle}
        >
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              {/* Left Column */}
              <div className="text-left">
                <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  {heroContent.badge || 'Tu badge'}
                </span>
                <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                  {heroContent.title || 'Título principal del hero'}
                </h2>
                <p className={`mt-3 max-w-xl text-sm ${brand.text200}`}>
                  {heroContent.subtitle || 'Subtítulo con tu propuesta de valor.'}
                </p>
                
                {/* Trust Badges */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(heroContent.trustBadges || ['Garantía escrita', 'Repuestos originales', 'Técnicos certificados']).map((label, i) => (
                    <div key={i} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80 ring-1 ring-white/15">
                      {label}
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                <div className="mt-6 flex flex-wrap gap-2">
                  <div className={`rounded-lg bg-white ${brand.ctaBtn} px-4 py-2 text-xs font-bold`}>
                    {heroContent.ctaPrimaryText || 'Ver productos'}
                  </div>
                  <div className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-xs font-medium backdrop-blur-sm">
                    {heroContent.ctaSecondaryText || 'Escribinos'}
                  </div>
                </div>

                {/* Track Repair */}
                <div className="mt-4 text-[11px] underline underline-offset-2 opacity-80">
                  {heroContent.trackRepairText || '¿Tenés una reparación? Rastreá tu equipo'}
                </div>
              </div>

              {/* Right Column: Stats Panel */}
              <div className="flex justify-center md:justify-end">
                <div className="rounded-2xl bg-white/10 p-6 shadow-xl ring-1 ring-white/20 backdrop-blur-md w-full max-w-[280px]">
                  {heroStats.enabled !== false && (
                    <div className="grid grid-cols-3 gap-2 border-b border-white/15 pb-4 text-center">
                      {[
                        { v: heroStats.repairs, l: 'Reparaciones' },
                        { v: heroStats.satisfaction, l: 'Satisfacción' },
                        { v: heroStats.avgTime, l: 'Tiempo prom.' },
                      ].map((s, i) => (
                        <div key={i}>
                          <div className="text-lg font-bold">{s.v || '—'}</div>
                          <div className={`mt-1 text-[9px] ${brand.text200}`}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={`mt-4 space-y-2 opacity-80 ${heroStats.enabled === false ? 'mt-0' : ''}`}>
                    <div className="rounded-lg bg-white/10 px-3 py-2 text-[10px] font-semibold flex justify-between">
                      <span>Ver catálogo de productos</span><span>→</span>
                    </div>
                    <div className="rounded-lg bg-white/10 px-3 py-2 text-[10px] font-semibold flex justify-between">
                      <span>Ofertas activas</span><span>→</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Hero content */}
      <SectionCard icon={Sparkles} title="Contenido del hero" description="Textos principales de la sección hero">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="badge" className="text-sm font-medium">Badge superior</Label>
            <Input
              id="badge"
              value={heroContent.badge}
              onChange={(e) => updateContent('badge', e.target.value)}
              placeholder="✨ Más de 10 años de experiencia"
              maxLength={100}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">Título principal</Label>
            <Input
              id="title"
              value={heroContent.title}
              onChange={(e) => updateContent('title', e.target.value)}
              placeholder="Reparación de celulares rápida y confiable"
              maxLength={150}
              aria-invalid={!!errors.title}
              className="h-11"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle" className="text-sm font-medium">Subtítulo</Label>
              <Textarea
                id="subtitle"
                value={heroContent.subtitle}
                onChange={(e) => updateContent('subtitle', e.target.value)}
                placeholder="Diagnóstico gratuito • Garantía de 6 meses • Técnicos certificados"
                rows={2}
                maxLength={300}
                className="text-sm"
              />
            </div>
          </div>
        </SectionCard>

        {/* Action Buttons & Links */}
        <SectionCard icon={TrendingUp} title="Botones y Enlaces" description="Textos de los botones de llamada a la acción">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ctaPrimaryText" className="text-sm font-medium">Botón principal</Label>
              <Input
                id="ctaPrimaryText"
                value={heroContent.ctaPrimaryText ?? 'Ver productos'}
                onChange={(e) => updateContent('ctaPrimaryText', e.target.value)}
                placeholder="Ej: Ver catálogo, Productos"
                maxLength={40}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaSecondaryText" className="text-sm font-medium">Botón secundario</Label>
              <Input
                id="ctaSecondaryText"
                value={heroContent.ctaSecondaryText ?? 'Escribinos'}
                onChange={(e) => updateContent('ctaSecondaryText', e.target.value)}
                placeholder="Ej: Contáctanos, Escribinos"
                maxLength={40}
                className="h-11"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="trackRepairText" className="text-sm font-medium">Enlace de rastreo de reparación</Label>
              <Input
                id="trackRepairText"
                value={heroContent.trackRepairText ?? '¿Tenés una reparación? Rastreá tu equipo'}
                onChange={(e) => updateContent('trackRepairText', e.target.value)}
                placeholder="Ej: Rastrear el estado de mi reparación"
                maxLength={100}
                className="h-11"
              />
            </div>
          </div>
        </SectionCard>

        {/* Trust Badges */}
        <SectionCard icon={Check} title="Insignias de Confianza" description="Atributos clave que se muestran en el Hero">
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Textos de las 3 insignias</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((idx) => {
                  const badges = heroContent.trustBadges || ['Garantía escrita', 'Repuestos originales', 'Técnicos certificados']
                  return (
                    <Input
                      key={idx}
                      value={badges[idx] || ''}
                      onChange={(e) => {
                        const newBadges = [...badges]
                        newBadges[idx] = e.target.value
                        updateContent('trustBadges', newBadges as any)
                      }}
                      placeholder={`Insignia ${idx + 1}`}
                      maxLength={30}
                      className="h-11 text-sm"
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </SectionCard>

      {/* Stats */}
      <SectionCard icon={TrendingUp} title="Estadísticas" description="Números mostrados en la sección hero">
        <div className="mb-6 flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Mostrar Estadísticas</Label>
            <p className="text-sm text-muted-foreground">Activa esta opción para mostrar los 3 números destacados.</p>
          </div>
          <Switch
            checked={heroStats.enabled !== false}
            onCheckedChange={(checked) => updateStat('enabled', checked as any)}
          />
        </div>
        {heroStats.enabled !== false && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="repairs" className="text-sm font-medium">Reparaciones</Label>
              <Input id="repairs" value={heroStats.repairs} onChange={(e) => updateStat('repairs', e.target.value)} placeholder="10K+" maxLength={20} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="satisfaction" className="text-sm font-medium">Satisfacción</Label>
              <Input id="satisfaction" value={heroStats.satisfaction} onChange={(e) => updateStat('satisfaction', e.target.value)} placeholder="98%" maxLength={20} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avgTime" className="text-sm font-medium">Tiempo promedio</Label>
              <Input id="avgTime" value={heroStats.avgTime} onChange={(e) => updateStat('avgTime', e.target.value)} placeholder="24-48h" maxLength={20} className="h-11" />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Save bar */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 md:sticky md:bottom-6 md:justify-end">
        {hasChanges && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setHeroContentDraft(null)
              setHeroStatsDraft(null)
              setErrors({})
            }}
            className="h-14 rounded-full px-6 shadow-2xl bg-background/80 backdrop-blur border md:h-12 md:rounded-xl md:px-4"
          >
            Descartar
          </Button>
        )}
        <Button type="submit" disabled={isSaving || !hasChanges} size="lg" className="h-14 rounded-full px-8 shadow-2xl md:h-12 md:rounded-xl md:px-6">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="hidden md:inline">Guardando...</span>
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              <span className="hidden md:inline">Guardar hero</span>
              <span className="md:hidden">Guardar</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
