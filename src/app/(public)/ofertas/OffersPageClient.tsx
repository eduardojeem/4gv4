'use client'

import Link from 'next/link'
import { Tag } from 'lucide-react'
import { OffersCarousel } from '@/components/public/inicio/OffersCarousel'
import { Button } from '@/components/ui/button'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'
import type { WebsiteSettings } from '@/types/website-settings'

interface OffersPageClientProps {
  initialSettings: WebsiteSettings
}

export function OffersPageClient({ initialSettings }: OffersPageClientProps) {
  const { settings: liveSettings } = useWebsiteSettings()
  const { tenantPrefix } = usePublicTenantPrefix()
  const settings = liveSettings ?? initialSettings

  if (!settings.offers_section.enabled) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-16 text-center">
        <div className="max-w-xl rounded-3xl border border-dashed bg-muted/20 px-6 py-14">
          <Tag className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Ofertas no disponibles</h1>
          <p className="mt-3 text-muted-foreground">
            Esta organización no tiene activa su sección de ofertas en este momento.
          </p>
          <Button asChild className="mt-6">
            <Link href={`${tenantPrefix}/productos`}>Ver todos los productos</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh]">
      <OffersCarousel
        companyName={settings.company_info.name || 'Tienda'}
        fallbackOffers={[]}
        settings={settings.offers_section}
      />
    </div>
  )
}
