'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WebsiteEditorDirtyContext } from '@/components/admin/website/website-editor-dirty'
import { CompanyInfoForm } from '@/components/admin/website/CompanyInfoForm'
import { HeroEditor } from '@/components/admin/website/HeroEditor'
import { ServicesManager } from '@/components/admin/website/ServicesManager'
import { ProcessStepsEditor } from '@/components/admin/website/ProcessStepsEditor'
import { CheckoutSettingsEditor } from '@/components/admin/website/CheckoutSettingsEditor'
import { OffersSectionEditor } from '@/components/admin/website/OffersSectionEditor'
import { PromotionalCarouselEditor } from '@/components/admin/website/PromotionalCarouselEditor'
import { SetupGuide } from '@/components/admin/website/SetupGuide'
import { Building2, Briefcase, Eye, Footprints, GalleryHorizontalEnd, Globe, ShoppingCart, Sparkles, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const TABS = [
  { value: 'company',  label: 'Empresa',   icon: Building2   },
  { value: 'hero',     label: 'Hero',      icon: Sparkles    },
  { value: 'carousel', label: 'Carrusel',  icon: GalleryHorizontalEnd },
  { value: 'offers',   label: 'Ofertas',   icon: Tag         },
  { value: 'services', label: 'Servicios', icon: Briefcase   },
  { value: 'process',  label: 'Proceso',   icon: Footprints  },
  { value: 'checkout', label: 'Pagos y entregas', icon: ShoppingCart },
]

export default function WebsiteAdminPage() {
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

      {/* Setup Guide */}
      <SetupGuide activeTab={tab} onTabChange={handleTabChange} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
        <div className="overflow-x-auto rounded-lg border bg-card p-1 [scrollbar-width:thin]">
          <TabsList className="inline-flex h-auto w-max min-w-full items-center justify-start gap-1 bg-transparent p-0">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                aria-label={label}
                className="inline-flex min-w-[112px] flex-1 items-center justify-center gap-2 rounded-md border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="company"  className="mt-0"><CompanyInfoForm /></TabsContent>
        <TabsContent value="hero"     className="mt-0"><HeroEditor /></TabsContent>
        <TabsContent value="carousel" className="mt-0"><PromotionalCarouselEditor /></TabsContent>
        <TabsContent value="offers"   className="mt-0"><OffersSectionEditor /></TabsContent>
        <TabsContent value="services" className="mt-0"><ServicesManager /></TabsContent>
        <TabsContent value="process"  className="mt-0"><ProcessStepsEditor /></TabsContent>
        <TabsContent value="checkout" className="mt-0"><CheckoutSettingsEditor /></TabsContent>
      </Tabs>
    </div>
   </WebsiteEditorDirtyContext.Provider>
  )
}
