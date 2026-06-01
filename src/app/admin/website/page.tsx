'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompanyInfoForm } from '@/components/admin/website/CompanyInfoForm'
import { HeroEditor } from '@/components/admin/website/HeroEditor'
import { ServicesManager } from '@/components/admin/website/ServicesManager'
import { ProcessStepsEditor } from '@/components/admin/website/ProcessStepsEditor'
import { CheckoutSettingsEditor } from '@/components/admin/website/CheckoutSettingsEditor'
import { Building2, Briefcase, Eye, Footprints, Globe, ShoppingCart, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const TABS = [
  { value: 'company',  label: 'Empresa',   icon: Building2   },
  { value: 'hero',     label: 'Hero',      icon: Sparkles    },
  { value: 'services', label: 'Servicios', icon: Briefcase   },
  { value: 'process',  label: 'Proceso',   icon: Footprints  },
  { value: 'checkout', label: 'Checkout',  icon: ShoppingCart },
]

export default function WebsiteAdminPage() {
  const [orgSlug, setOrgSlug] = useState('')

  useEffect(() => {
    fetch('/api/onboarding/status')
      .then(r => r.json())
      .catch(() => null)
      .then((d: { organization?: { slug?: string } } | null) => {
        if (d?.organization?.slug) setOrgSlug(d.organization.slug)
      })
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-sm">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Sitio web</h1>
            <p className="text-sm text-muted-foreground">Contenido y apariencia del portal publico</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={orgSlug ? `/${orgSlug}/inicio` : '/inicio'} target="_blank">
            <Eye className="mr-2 h-4 w-4" />
            Vista previa
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="company" className="space-y-6">
        <div className="-mb-px overflow-x-auto">
          <TabsList className="inline-flex h-auto w-max min-w-full items-end gap-0 rounded-none border-b border-border bg-transparent p-0">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative -mb-px inline-flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="company"  className="mt-0"><CompanyInfoForm /></TabsContent>
        <TabsContent value="hero"     className="mt-0"><HeroEditor /></TabsContent>
        <TabsContent value="services" className="mt-0"><ServicesManager /></TabsContent>
        <TabsContent value="process"  className="mt-0"><ProcessStepsEditor /></TabsContent>
        <TabsContent value="checkout" className="mt-0"><CheckoutSettingsEditor /></TabsContent>
      </Tabs>
    </div>
  )
}
