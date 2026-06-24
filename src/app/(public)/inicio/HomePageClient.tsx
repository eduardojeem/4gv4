'use client'

import { useMemo } from 'react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { HeroSection } from '@/components/public/inicio/HeroSection'
import { CategoryShowcase } from '@/components/public/inicio/CategoryShowcase'
import { FeaturedProducts } from '@/components/public/inicio/FeaturedProducts'
import { OffersCarousel } from '@/components/public/inicio/OffersCarousel'
import { ServicesGrid } from '@/components/public/inicio/ServicesGrid'
import { ProcessSteps } from '@/components/public/inicio/ProcessSteps'
import { ContactCTA } from '@/components/public/inicio/ContactCTA'
import { BranchLocations } from '@/components/public/inicio/BranchLocations'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { WebsiteSettings } from '@/types/website-settings'

interface HomePageClientProps {
  initialSettings: WebsiteSettings
  branches?: BranchLocationData[]
}

export default function HomePageClient({ initialSettings, branches = [] }: HomePageClientProps) {
  // SWR picks up realtime updates; initialSettings avoids the loading spinner on first paint
  const { settings: liveSettings } = useWebsiteSettings()
  const settings = liveSettings ?? initialSettings

  const company_info = settings.company_info ?? {
    name: '4G Movil',
    phone: '',
    email: '',
    address: '',
    hours: { weekdays: '', saturday: '', sunday: '' },
    brandColor: 'blue' as const,
  }

  const hero_stats = settings.hero_stats ?? {
    repairs: '0+',
    satisfaction: '0%',
    avgTime: '24h',
  }

  const hero_content = settings.hero_content ?? {
    badge: 'Servicio tecnico',
    title: 'Reparacion y venta de tecnologia',
    subtitle: 'Atencion experta para mantener tus equipos en su mejor estado.',
  }

  const services = settings.services
  const safeServices = useMemo(
    () => Array.isArray(services) ? services.filter(s => s.active !== false) : [],
    [services]
  )

  const processSteps = useMemo(
    () => Array.isArray(settings.process_steps) ? settings.process_steps : [],
    [settings.process_steps]
  )

  const phone = company_info.phone
  const email = company_info.email
  const { phoneClean, contactHref } = useMemo(() => {
    const clean = (phone || '').replace(/\D/g, '')
    const emailVal = email || ''
    return {
      phoneClean: clean,
      contactHref: clean
        ? `https://wa.me/${clean}`
        : emailVal
          ? `mailto:${emailVal}`
          : '/inicio#contacto',
    }
  }, [phone, email])

  const brand = getBrandTheme(company_info.brandColor)

  return (
    <div className="flex flex-col">
      <HeroSection
        companyInfo={company_info}
        heroStats={hero_stats}
        heroContent={hero_content}
        brand={brand}
        phoneClean={phoneClean}
        contactHref={contactHref}
      />

      {/* ── Sales-first sections ── */}
      <CategoryShowcase />

      {settings.offers_section.enabled && (
        <div id="ofertas">
          <OffersCarousel
            companyName={company_info.name || '4G Movil'}
            settings={settings.offers_section}
          />
        </div>
      )}

      <FeaturedProducts />

      {/* ── Services (kept for the mixed model) ── */}
      <ServicesGrid services={safeServices} />

      {/* ── Trust / secondary ── */}
      {company_info.processSectionEnabled !== false && (
        <ProcessSteps brand={brand} steps={processSteps} />
      )}

      <BranchLocations branches={branches} brand={brand} />

      <ContactCTA
        companyInfo={company_info}
        brand={brand}
        phoneClean={phoneClean}
        contactHref={contactHref}
      />
    </div>
  )
}
