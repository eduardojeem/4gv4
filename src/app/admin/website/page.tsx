'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WebsiteEditorDirtyContext } from '@/components/admin/website/website-editor-dirty'
import { CompanyInfoForm } from '@/components/admin/website/CompanyInfoForm'
import { HeroEditor } from '@/components/admin/website/HeroEditor'
import { ServicesManager } from '@/components/admin/website/ServicesManager'
import { ProcessStepsEditor } from '@/components/admin/website/ProcessStepsEditor'
import { CheckoutSettingsEditor } from '@/components/admin/website/CheckoutSettingsEditor'
import { OffersSectionEditor } from '@/components/admin/website/OffersSectionEditor'
import { PromotionalCarouselEditor } from '@/components/admin/website/PromotionalCarouselEditor'
import { TrustBarEditor } from '@/components/admin/website/TrustBarEditor'
import { BrandsSectionEditor } from '@/components/admin/website/BrandsSectionEditor'
import { SetupGuide } from '@/components/admin/website/SetupGuide'
import { WebsiteHowItWorksDialog } from '@/components/admin/website/WebsiteHowItWorksDialog'
import { WebsiteSectionIntro } from '@/components/admin/website/WebsiteSectionIntro'
import { AlertTriangle, Eye, Globe, RotateCw } from 'lucide-react'
import { WebsiteNavigation } from '@/components/admin/website/WebsiteNavigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function WebsiteAdminPage() {
  const { settings, refresh, isRefreshing } = useAdminWebsiteSettings()
  const { businessVertical, operatingModel, effectiveModules } = useSubscriptionStatus()
  const storefrontCapabilities = useMemo(() => resolveStorefrontCapabilities({
    businessVertical,
    operatingModel,
    effectiveModules,
  }), [businessVertical, operatingModel, effectiveModules])
  const hasServicesModule = storefrontCapabilities.hasServices
  const hasRepairsModule = storefrontCapabilities.hasRepairs
  const servicesModuleEnabled = hasServicesModule || hasRepairsModule

  const [orgSlug, setOrgSlug] = useState<string | null>(null)
  const [tab, setTab] = useState('company')
  const dirtyRef = useRef(false)

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  const handleTabChange = (next: string) => {
    if (next !== tab && dirtyRef.current) {
      const ok = window.confirm('Tenés cambios sin guardar. ¿Descartarlos y cambiar de pestaña?')
      if (!ok) return
      dirtyRef.current = false
    }
    setTab(next)
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

  return (
   <WebsiteEditorDirtyContext.Provider value={{ setDirty }}>
    <div className="mx-auto max-w-[1500px] space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Sitio web público</h1>
            <p className="text-sm text-muted-foreground">Contenido, ventas y experiencia de tu tienda online</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
            title="Actualizar datos del sitio web"
          >
            <RotateCw className={cn("h-4 w-4", isRefreshing && "animate-spin text-primary")} />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </Button>

          <WebsiteHowItWorksDialog
            currentTab={tab}
            orgSlug={orgSlug}
            onNavigateToTab={handleTabChange}
          />
          {orgSlug ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${orgSlug}/inicio`} target="_blank" rel="noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                Vista previa
              </Link>
            </Button>
          ) : orgSlug === null ? (
            <Button variant="outline" size="sm" disabled aria-label="Cargando enlace de vista previa">
              <Eye className="mr-2 h-4 w-4" />
              Cargando vista previa
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled aria-label="Vista previa no disponible">
              <Eye className="mr-2 h-4 w-4" />
              Vista previa no disponible
            </Button>
          )}
        </div>
      </div>

      {/* Setup Guide */}
      {settings && (
        <div role="status" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border bg-muted/30 p-3.5 sm:p-4 text-sm">
          <div className="space-y-0.5 min-w-0">
            <p className="font-semibold text-foreground flex items-center gap-2">
              <span className={cn(
                'h-2 w-2 rounded-full shrink-0',
                settings.company_info.storefrontPublic ? 'bg-emerald-500' : 'bg-amber-500'
              )} />
              {settings.company_info.storefrontPublic ? 'Tienda publicada' : 'Tienda sin publicar'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {settings.company_info.storefrontPublic
                ? (settings.company_info.marketplacePublic ? 'Enlace público y Marketplace activos.' : 'Enlace público activo. No aparece en Marketplace.')
                : 'Podés preparar tus secciones. Activarlas no publica la tienda automáticamente.'}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleTabChange('company')}
            className="w-full sm:w-auto shrink-0 rounded-xl text-xs h-8"
          >
            Configurar publicación
          </Button>
        </div>
      )}
      <SetupGuide activeTab={tab} onTabChange={handleTabChange} />

      {/* Tabs */}
      <div className="grid items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <WebsiteNavigation
          value={tab}
          onChange={handleTabChange}
          settings={settings}
          servicesModuleEnabled={servicesModuleEnabled}
        />
        <div className="min-w-0">

        {tab === 'company' && <section aria-label="Editor de sección"><WebsiteSectionIntro section="company" /><CompanyInfoForm /></section>}
        {tab === 'hero' && <section aria-label="Editor de sección"><WebsiteSectionIntro section="hero" /><HeroEditor capabilities={storefrontCapabilities} /></section>}
        {tab === 'trust_bar' && <section aria-label="Editor de sección"><WebsiteSectionIntro section="trust_bar" /><TrustBarEditor /></section>}
        {tab === 'brands' && <section aria-label="Editor de sección"><WebsiteSectionIntro section="brands" /><BrandsSectionEditor /></section>}
        {tab === 'carousel' && <section aria-label="Editor de sección"><WebsiteSectionIntro section="carousel" /><PromotionalCarouselEditor /></section>}
        {tab === 'offers' && <section aria-label="Editor de sección"><WebsiteSectionIntro section="offers" /><OffersSectionEditor /></section>}
        {tab === 'services' && (
          <section aria-label="Catálogo de servicios">
            <WebsiteSectionIntro section="services" />
            {!servicesModuleEnabled && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Módulo de servicios y reparaciones no activo en tu suscripción</p>
                  <p className="text-muted-foreground">
                    Tu plan actual no incluye los módulos de <strong>Servicios</strong> ni <strong>Reparaciones</strong>. Podés preparar el catálogo en modo borrador, pero permanecerá oculto para los clientes en tu tienda web hasta que actives el módulo.
                  </p>
                </div>
              </div>
            )}
            <ServicesManager orgSlug={orgSlug} servicesModuleEnabled={servicesModuleEnabled} />
          </section>
        )}
        {tab === 'process' && <section aria-label="Editor de sección"><WebsiteSectionIntro section="process" /><ProcessStepsEditor /></section>}
        {tab === 'checkout' && <section aria-label="Editor de sección"><WebsiteSectionIntro section="checkout" /><CheckoutSettingsEditor /></section>}
        </div>
      </div>
    </div>
   </WebsiteEditorDirtyContext.Provider>
  )
}
