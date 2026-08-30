'use client'

import { useMemo } from 'react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { HeroSection } from '@/components/public/inicio/HeroSection'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'
import { CategoryShowcase } from '@/components/public/inicio/CategoryShowcase'
import { FeaturedProducts } from '@/components/public/inicio/FeaturedProducts'
import { OffersCarousel } from '@/components/public/inicio/OffersCarousel'
import { ServicesGrid } from '@/components/public/inicio/ServicesGrid'
import { ProcessSteps } from '@/components/public/inicio/ProcessSteps'
import { getPublicProcessFlows } from '@/lib/website/process-steps'
import { isPublicServicesPageAvailable, isPublicRepairsAvailable } from '@/lib/website/services'
import { ContactCTA } from '@/components/public/inicio/ContactCTA'
import { BranchLocations } from '@/components/public/inicio/BranchLocations'
import { OrganizationReviews } from '@/components/public/inicio/OrganizationReviews'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { WebsiteSettings } from '@/types/website-settings'

interface HomePageClientProps {
  initialSettings: WebsiteSettings
  branches?: BranchLocationData[]
}

export default function HomePageClient({ initialSettings, branches = [] }: HomePageClientProps) {
  const { settings: liveSettings } = useWebsiteSettings()
  const settings = liveSettings ?? initialSettings

  const company_info = settings.company_info ?? {
    name: 'Tienda Oficial',
    phone: '',
    email: '',
    address: '',
    hours: { weekdays: '', saturday: '', sunday: '' },
    brandColor: 'blue' as const,
  }

  const hero_stats = settings.hero_stats ?? {
    repairs: '100%',
    satisfaction: '4.9★',
    avgTime: '24h',
  }

  const hero_content = settings.hero_content ?? {
    badge: 'Catálogo Oficial',
    title: 'Los mejores productos al mejor precio',
    subtitle: 'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y envíos a todo el país.',
  }

  const services = settings.services
  const safeServices = useMemo(
    () => (Array.isArray(services) ? services.filter((s) => s.active !== false) : []),
    [services]
  )

  const processSteps = useMemo(
    () => (Array.isArray(settings.process_steps) ? settings.process_steps : []),
    [settings.process_steps]
  )
  const processFlows = useMemo(
    () => getPublicProcessFlows(settings.process_flows, processSteps),
    [settings.process_flows, processSteps]
  )

  // Validaciones dinámicas según configuración y rubro de la empresa
  const hasServices = isPublicServicesPageAvailable(company_info.servicesPageEnabled, services)
  const hasRepairs = isPublicRepairsAvailable(company_info, services)
  const hasProcessSteps = company_info.processSectionEnabled !== false && processFlows.length > 0

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
  const heroVisible = hero_content.enabled !== false
  const promotionalCarouselVisible = Boolean(
    settings.promotional_carousel?.enabled &&
      settings.promotional_carousel.slides.some((slide) => slide.active)
  )

  return (
    <div className="flex flex-col min-h-screen">
      {!heroVisible && !promotionalCarouselVisible && (
        <h1 className="sr-only">{company_info.name || 'Inicio'}</h1>
      )}

      {/* ── 1. Hero Principal con Buscador y Llamados a la Acción ── */}
      {heroVisible && (
        <HeroSection
          companyInfo={company_info}
          heroStats={hero_stats}
          heroContent={hero_content}
          brand={brand}
          phoneClean={phoneClean}
          contactHref={contactHref}
          hasRepairs={hasRepairs}
        />
      )}

      {/* ── 2. Barra de Beneficios y Confianza de Compra (Envíos, Cuotas, Garantía) ── */}
      <StoreTrustBar />

      {/* ── 3. Banners Promocionales ── */}
      <PromotionalCarousel
        settings={settings.promotional_carousel}
        isPageLead={!heroVisible && promotionalCarouselVisible}
      />

      {/* ── 4. Showcase de Categorías ── */}
      <CategoryShowcase />

      {/* ── 5. Carrusel de Ofertas Especiales ── */}
      {settings.offers_section?.enabled && (
        <div id="ofertas">
          <OffersCarousel
            companyName={company_info.name || 'Tienda'}
            settings={settings.offers_section}
          />
        </div>
      )}

      {/* ── 6. Productos Destacados con Filtros Rápidos ── */}
      <FeaturedProducts />

      {/* ── 7. Servicios Técnicos (SÓLO si la empresa los ofrece y tiene activos) ── */}
      {hasServices && <ServicesGrid services={safeServices} />}

      {/* ── 8. Pasos del Proceso (SÓLO si la empresa los tiene habilitados y configurados) ── */}
      {hasProcessSteps && (
        <ProcessSteps brand={brand} flows={processFlows} />
      )}

      {/* ── 9. Sucursales de la Tienda ── */}
      {branches.length > 0 && <BranchLocations branches={branches} brand={brand} />}

      {/* ── 10. Reseñas y Opiniones de Clientes ── */}
      <OrganizationReviews />

      {/* ── 11. Centro de Contacto y Asesoramiento WhatsApp ── */}
      <ContactCTA
        companyInfo={company_info}
        brand={brand}
        phoneClean={phoneClean}
        contactHref={contactHref}
      />
    </div>
  )
}
