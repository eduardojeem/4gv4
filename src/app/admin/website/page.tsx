'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WebsiteEditorDirtyContext } from '@/components/admin/website/website-editor-dirty'
import { CompanyInfoForm } from '@/components/admin/website/CompanyInfoForm'
import { HeroEditor } from '@/components/admin/website/HeroEditor'
import { ServicesManager } from '@/components/admin/website/ServicesManager'
import { BookingSectionEditor } from '@/components/admin/website/BookingSectionEditor'
import { GalleryEditor } from '@/components/admin/website/GalleryEditor'
import { ProcessStepsEditor } from '@/components/admin/website/ProcessStepsEditor'
import { CheckoutSettingsEditor } from '@/components/admin/website/CheckoutSettingsEditor'
import { OffersSectionEditor } from '@/components/admin/website/OffersSectionEditor'
import { PromotionalCarouselEditor } from '@/components/admin/website/PromotionalCarouselEditor'
import { TrustBarEditor } from '@/components/admin/website/TrustBarEditor'
import { AnnouncementEditor } from '@/components/admin/website/AnnouncementEditor'
import { BrandsSectionEditor } from '@/components/admin/website/BrandsSectionEditor'
import { WebsiteHowItWorksDialog } from '@/components/admin/website/WebsiteHowItWorksDialog'
import { WebsiteSectionIntro } from '@/components/admin/website/WebsiteSectionIntro'
import { SectionAssistant } from '@/components/admin/website/SectionAssistant'
import type { CoachSection } from '@/lib/website/section-coach'
import { WebsiteOverview } from '@/components/admin/website/WebsiteOverview'
import { WebsiteAssistantDialog } from '@/components/admin/website/WebsiteAssistant'
import { ArrowLeft, Lock, ArrowRight, ExternalLink, Globe, Images, MoreHorizontal, RotateCw, Sparkles } from 'lucide-react'
import { WebsiteNavigation } from '@/components/admin/website/WebsiteNavigation'
import { WebsiteMediaLibraryDialog } from '@/components/admin/website/WebsiteMediaLibraryDialog'
import { useWebsiteMediaQuota } from '@/hooks/useWebsiteMediaQuota'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import {
  buildWebsiteSetupChecklist,
  type WebsiteSectionAnchor,
  type WebsiteSectionId,
} from '@/lib/website/setup-checklist'
import { isSectionAvailable, resolveSectionAvailability, type WebsiteEditableSection } from '@/lib/website/section-availability'
import { resolveStorefrontStyle } from '@/lib/website/storefront-style'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/** Lleva a una tarjeta dentro de la pestaña, abriéndola si está plegada. */
function revealAnchor(anchor: WebsiteSectionAnchor, attempt = 0) {
  const target = document.getElementById(anchor)
  if (!target) {
    if (attempt < 10) window.setTimeout(() => revealAnchor(anchor, attempt + 1), 80)
    return
  }
  const details = target.querySelector('details')
  if (details) details.open = true
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function WebsiteAdminPage() {
  const { settings, refresh, isRefreshing } = useAdminWebsiteSettings()
  const { businessVertical, operatingModel, effectiveModules, planName } = useSubscriptionStatus()
  const storefrontCapabilities = useMemo(() => resolveStorefrontCapabilities({
    businessVertical,
    operatingModel,
    effectiveModules,
  }), [businessVertical, operatingModel, effectiveModules])
  const hasServicesModule = storefrontCapabilities.hasServices
  const hasRepairsModule = storefrontCapabilities.hasRepairs
  const servicesModuleEnabled = hasServicesModule || hasRepairsModule
  const checklist = useMemo(
    () => (settings ? buildWebsiteSetupChecklist(settings, storefrontCapabilities) : null),
    [settings, storefrontCapabilities],
  )
  // Las secciones de módulos que la cuenta no tiene no se editan ni se publican.
  const availability = useMemo(() => resolveSectionAvailability(storefrontCapabilities), [storefrontCapabilities])
  // La plantilla que ve el cliente: los editores piden solo lo que ella muestra.
  const storefrontStyle = resolveStorefrontStyle(settings?.company_info?.storefrontStyle, businessVertical, {
    servicesAvailable: storefrontCapabilities.hasServices,
  })

  const [orgSlug, setOrgSlug] = useState<string | null>(null)
  const [tab, setTab] = useState<string>('overview')
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  // Los editores copian los ajustes a su estado al montarse: tras aplicar sugerencias se remontan.
  const [editorVersion, setEditorVersion] = useState(0)
  const { count: mediaCount, limit: mediaLimit, isAtLimit: isMediaAtLimit } = useWebsiteMediaQuota()
  const dirtyRef = useRef(false)

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  const handleTabChange = (next: string): boolean => {
    if (next === tab) return true
    if (dirtyRef.current) {
      const ok = window.confirm('Tenés cambios sin guardar. ¿Descartarlos y cambiar de sección?')
      if (!ok) return false
      dirtyRef.current = false
    }
    setTab(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  const navigateTo = (section: Exclude<WebsiteSectionId, 'overview'>, anchor?: WebsiteSectionAnchor) => {
    if (!handleTabChange(section)) return
    if (anchor) window.setTimeout(() => revealAnchor(anchor), 50)
  }

  const openAssistant = () => {
    // Aplicar sugerencias remonta el editor abierto: no perder lo que no se guardó.
    if (dirtyRef.current && !window.confirm('Tenés cambios sin guardar en esta sección. Si aplicás sugerencias se descartan. ¿Continuar?')) return
    setAiOpen(true)
  }

  const handleRefresh = async () => {
    if (dirtyRef.current) {
      const ok = window.confirm(
        'Tenés cambios sin guardar en la sección actual. ¿Deseás actualizar desde el servidor y descartar los cambios no guardados?'
      )
      if (!ok) return
      dirtyRef.current = false
    }
    const res = await refresh()
    if (res?.success) {
      toast.success('Contenido del sitio actualizado')
    } else {
      toast.error('No se pudo actualizar el contenido')
    }
  }

  // Warn before closing/reloading with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  useEffect(() => {
    fetch('/api/onboarding/status')
      .then(r => r.json())
      .catch(() => null)
      .then((d: { organization?: { slug?: string } } | null) => {
        setOrgSlug(d?.organization?.slug || '')
      })

    const handleSlugUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setOrgSlug(customEvent.detail)
    }
    window.addEventListener('website-slug-updated', handleSlugUpdate)
    return () => window.removeEventListener('website-slug-updated', handleSlugUpdate)
  }, [])

  // Título de la sección y, debajo, su asistente con lo que conviene corregir.
  const intro = (section: CoachSection) => (
    <>
      <WebsiteSectionIntro section={section} />
      <SectionAssistant
        section={section}
        settings={settings}
        context={{ capabilities: storefrontCapabilities, storefrontStyle, effectiveModules }}
        onNavigate={(target) => navigateTo(target)}
        onOpenAssistant={openAssistant}
      />
    </>
  )

  const show = (section: WebsiteEditableSection) => tab === section && availability[section].available
  const lockedSection = tab !== 'overview' && tab in availability && !availability[tab as WebsiteEditableSection].available
    ? (tab as WebsiteEditableSection)
    : null
  const isPublic = settings?.company_info.storefrontPublic === true
  const storeHref = orgSlug ? `/${orgSlug}/inicio` : null
  const pendingSteps = checklist
    ? [...checklist.essentials, ...checklist.recommended]
        .filter((step) => !step.done)
        .map((step) => ({ section: step.section, title: step.title }))
    : []
  const nextStep = checklist?.next && checklist.next.section !== tab ? checklist.next : null

  return (
   <WebsiteEditorDirtyContext.Provider value={{ setDirty }}>
    <div className="mx-auto max-w-[1500px] space-y-5 pb-8">
      {/* Encabezado: estado, ver tienda y lo demás en un menú */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">Sitio web</h1>
              {settings && (
                <span
                  role="status"
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs',
                    isPublic ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', isPublic ? 'bg-emerald-500' : 'bg-amber-500')} />
                  {isPublic ? 'Publicada' : 'Sin publicar'}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Armá y personalizá la tienda online de tu negocio</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openAssistant}>
            <Sparkles className="h-4 w-4 text-primary" />
            Asistente
          </Button>

          <WebsiteHowItWorksDialog
            currentTab={tab}
            orgSlug={orgSlug}
            onNavigateToTab={handleTabChange}
            isSectionAvailable={(section) => isSectionAvailable(availability, section)}
          />

          {storeHref ? (
            <Button size="sm" asChild className="gap-2">
              <Link href={storeHref} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Ver mi tienda
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled aria-label={orgSlug === null ? 'Cargando enlace de vista previa' : 'Vista previa no disponible'}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver mi tienda
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Más opciones">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={() => setMediaDialogOpen(true)} className="gap-2">
                <Images className="h-4 w-4" />
                <span className="flex-1">Historial de imágenes</span>
                <span className={cn('text-xs tabular-nums', isMediaAtLimit ? 'text-destructive' : 'text-muted-foreground')}>
                  {mediaCount}/{mediaLimit}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleRefresh()} disabled={isRefreshing} className="gap-2">
                <RotateCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                {isRefreshing ? 'Actualizando…' : 'Recargar datos del sitio'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <WebsiteMediaLibraryDialog
            open={mediaDialogOpen}
            onOpenChange={setMediaDialogOpen}
          />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <WebsiteNavigation
          value={tab}
          onChange={handleTabChange}
          settings={settings}
          servicesModuleEnabled={servicesModuleEnabled}
          onOpenMediaHistory={() => setMediaDialogOpen(true)}
          focus={checklist?.focus}
          availability={availability}
          progress={checklist ? { done: checklist.done, total: checklist.total } : undefined}
        />
        <div className="min-w-0" key={editorVersion}>

        {tab === 'overview' && (
          checklist ? (
            <WebsiteOverview
              checklist={checklist}
              businessLabel={storefrontCapabilities.businessLabel}
              storeHref={isPublic ? storeHref : null}
              isPublic={isPublic}
              onOpenAi={openAssistant}
              onNavigate={navigateTo}
              availability={availability}
              account={{
                planName,
                hasCatalog: storefrontCapabilities.hasCatalog,
                hasServices: hasServicesModule,
                hasRepairs: hasRepairsModule,
              }}
            />
          ) : (
            <div className="h-64 animate-pulse rounded-2xl border bg-muted/30" aria-label="Cargando resumen" />
          )
        )}
        {show('company') && <section aria-label="Editor de sección">{intro('company')}<CompanyInfoForm /></section>}
        {show('hero') && <section aria-label="Editor de sección">{intro('hero')}<HeroEditor capabilities={storefrontCapabilities} storefrontStyle={storefrontStyle} /></section>}
        {show('trust_bar') && <section aria-label="Editor de sección">{intro('trust_bar')}<TrustBarEditor capabilities={storefrontCapabilities} storefrontStyle={storefrontStyle} /></section>}
        {show('brands') && <section aria-label="Editor de sección">{intro('brands')}<BrandsSectionEditor /></section>}
        {show('carousel') && <section aria-label="Editor de sección">{intro('carousel')}<PromotionalCarouselEditor /></section>}
        {show('offers') && <section aria-label="Editor de sección">{intro('offers')}<OffersSectionEditor /></section>}
        {show('announcement') && <section aria-label="Editor de sección">{intro('announcement')}<AnnouncementEditor capabilities={storefrontCapabilities} /></section>}
        {show('services') && (
          <section aria-label="Catálogo de servicios">
            {intro('services')}
            <ServicesManager orgSlug={orgSlug} servicesModuleEnabled={servicesModuleEnabled} capabilities={storefrontCapabilities} />
          </section>
        )}
        {show('gallery') && <section aria-label="Editor de sección">{intro('gallery')}<GalleryEditor /></section>}
        {show('booking') && <section aria-label="Editor de sección">{intro('booking')}<BookingSectionEditor orgSlug={orgSlug} /></section>}
        {show('process') && <section aria-label="Editor de sección">{intro('process')}<ProcessStepsEditor capabilities={storefrontCapabilities} /></section>}
        {show('checkout') && <section aria-label="Editor de sección">{intro('checkout')}<CheckoutSettingsEditor capabilities={storefrontCapabilities} onNavigate={(target) => navigateTo(target)} /></section>}

        {lockedSection && (
          <section aria-label="Sección no disponible" className="rounded-2xl border bg-card p-6 text-center shadow-2xs">
            <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
            <h2 className="mt-2 text-base font-semibold">Esta sección no está disponible en tu cuenta</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Requiere {availability[lockedSection].requires}. Mientras no esté activo, no se muestra en tu tienda.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link href="/admin/subscriptions">Ver planes y módulos</Link>
            </Button>
          </section>
        )}

        {/* Guía al pie: volver al resumen o seguir con lo que falta */}
        {tab !== 'overview' && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" size="sm" className="gap-2 self-start" onClick={() => handleTabChange('overview')}>
              <ArrowLeft className="h-4 w-4" />
              Volver al resumen
            </Button>
            {nextStep && (
              <Button type="button" size="sm" className="gap-2" onClick={() => navigateTo(nextStep.section, nextStep.anchor)}>
                <span className="truncate">Siguiente: {nextStep.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Button>
            )}
          </div>
        )}
        </div>
      </div>

      <WebsiteAssistantDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        settings={settings}
        context={{ vertical: storefrontCapabilities.businessVertical, focus: checklist?.focus ?? 'retail', pending: pendingSteps }}
        onNavigate={(section) => navigateTo(section)}
        onApplied={() => {
          dirtyRef.current = false
          setEditorVersion((version) => version + 1)
        }}
      />
    </div>
   </WebsiteEditorDirtyContext.Provider>
  )
}
