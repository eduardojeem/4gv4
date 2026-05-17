'use client'

import { useMemo } from 'react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { HeroSection } from '@/components/public/inicio/HeroSection'
import { OffersCarousel } from '@/components/public/inicio/OffersCarousel'
import type { OfferCard } from '@/components/public/inicio/OffersCarousel'
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

  const companyName = company_info.name
  const fallbackOffers: OfferCard[] = useMemo(() => {
    const serviceCards = safeServices.slice(0, 8).map((service, index) => ({
      id: `service-${service.id || index}`,
      title: service.title,
      description: service.description || 'Servicio tecnico profesional',
      priceLabel: 'Consulta precio',
      originalPriceLabel: undefined,
      tag: 'Servicio',
      ctaHref: '/inicio#contacto',
      image: null,
      brand: companyName || null,
      inStock: true,
    }))

    if (serviceCards.length > 0) return serviceCards

    return [
      {
        id: 'fallback-1',
        title: 'Cambio de pantalla',
        description: 'Repuestos de calidad con garantia escrita.',
        priceLabel: 'Desde $49.990',
        originalPriceLabel: undefined,
        tag: 'Oferta',
        ctaHref: '/inicio#contacto',
        image: null,
        brand: companyName || null,
        inStock: true,
      },
      {
        id: 'fallback-2',
        title: 'Bateria nueva',
        description: 'Recupera autonomia y rendimiento de carga.',
        priceLabel: 'Desde $29.990',
        originalPriceLabel: undefined,
        tag: 'Top venta',
        ctaHref: '/inicio#contacto',
        image: null,
        brand: companyName || null,
        inStock: true,
      },
      {
        id: 'fallback-3',
        title: 'Limpieza interna',
        description: 'Mantenimiento preventivo y optimizacion.',
        priceLabel: 'Desde $19.990',
        originalPriceLabel: undefined,
        tag: 'Promo',
        ctaHref: '/inicio#contacto',
        image: null,
        brand: companyName || null,
        inStock: true,
      },
    ]
  }, [safeServices, companyName])

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

      <OffersCarousel
        companyName={company_info.name || '4G Movil'}
        fallbackOffers={fallbackOffers}
      />

      <ServicesGrid services={safeServices} />

      <ProcessSteps brand={brand} steps={processSteps} />

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
