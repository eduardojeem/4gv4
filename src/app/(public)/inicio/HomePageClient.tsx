'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { HeroSection } from '@/components/public/inicio/HeroSection'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'
import { CategoryShowcase } from '@/components/public/inicio/CategoryShowcase'
import { FeaturedProducts } from '@/components/public/inicio/FeaturedProducts'
import { StoreOffersPromoShowcase } from '@/components/public/inicio/StoreOffersPromoShowcase'
import { ServicesGrid } from '@/components/public/inicio/ServicesGrid'
import { ProcessSteps } from '@/components/public/inicio/ProcessSteps'
import { getPublicProcessFlows } from '@/lib/website/process-steps'
import {
  canPublishRepairs,
  canPublishServices,
  resolvePublishedHeroActions,
  type StorefrontCapabilities,
} from '@/lib/website/storefront-capabilities'
import { ContactCTA } from '@/components/public/inicio/ContactCTA'
import { BranchLocations } from '@/components/public/inicio/BranchLocations'
import { OrganizationReviews } from '@/components/public/inicio/OrganizationReviews'
import { StoreBrandTicker } from '@/components/public/inicio/StoreBrandTicker'
import { StorefrontAudienceLinks } from '@/components/public/inicio/StorefrontAudienceLinks'
import { FashionCampaignBanner } from '@/components/public/inicio/FashionCampaignBanner'
import { HeroCampaign } from '@/components/public/inicio/HeroCampaign'
import { CategoryCollections } from '@/components/public/inicio/CategoryCollections'
import { SportHero } from '@/components/public/inicio/SportHero'
import { MarketAisles, MarketDeals, MarketHero } from '@/components/public/inicio/MarketSections'
import { BookingSection, ServiceGallery, ServiceMenu, ServiceTeam, ServicesHero, ServicesLocation, buildServiceMenu, useNextFreeSlot, usePublicAgenda } from '@/components/public/inicio/ServicesHome'
import { FloatingWhatsAppButton } from '@/components/public/FloatingWhatsAppButton'
import { useStorefrontCompanyInfo, useStorefrontStyle } from '@/components/public/storefront-style-context'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { WebsiteSettings } from '@/types/website-settings'


interface HomePageClientProps {
  initialSettings: WebsiteSettings
  branches?: BranchLocationData[]
  capabilities: StorefrontCapabilities
}

export default function HomePageClient({ initialSettings, branches = [], capabilities }: HomePageClientProps) {
  const { settings: liveSettings } = useWebsiteSettings()
  const settings = liveSettings ?? initialSettings
  const storefrontStyle = useStorefrontStyle()

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

  const hero_content = useMemo(() => settings.hero_content ?? {
    badge: 'Catálogo Oficial',
    title: 'Los mejores productos al mejor precio',
    subtitle: 'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y envíos a todo el país.',
  }, [settings.hero_content])

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
  const hasServices = canPublishServices(capabilities, company_info.servicesPageEnabled, services)
  const hasRepairs = canPublishRepairs(capabilities, company_info.repairTrackingEnabled, services)
  const heroActions = resolvePublishedHeroActions(capabilities, {
    servicesVisible: hasServices,
    repairsVisible: hasRepairs,
  })
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

  const pathname = usePathname()
  const pathTenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = pathTenantSlug ? `/${pathTenantSlug}` : ''


  const previewCompanyInfo = useStorefrontCompanyInfo(company_info)
  const brand = getBrandTheme(previewCompanyInfo.brandColor)
  const heroVisible = hero_content.enabled !== false
  const promotionalCarouselVisible = Boolean(
    settings.promotional_carousel?.enabled &&
      settings.promotional_carousel.slides.some((slide) => slide.active)
  )

  const trustBarPosition = settings.trust_bar?.position || 'above_carousel'
  const trustBarVisible = settings.trust_bar?.enabled !== false

  const isClassic = storefrontStyle === 'classic'
  const isServices = storefrontStyle === 'services'
  const isMarket = storefrontStyle === 'market'
  // Moda, Deportivo, Tecnología y Moderno comparten la vidriera de colecciones con foto.
  const isShowcase = !isClassic && !isServices && !isMarket

  // «Reservá tu turno» en el inicio: cualquier plantilla puede mostrarla si la agenda toma turnos online.
  const bookingSettings = settings.booking_section
  const bookingEnabled = Boolean(bookingSettings?.enabled)
  // En el subdominio propio la ruta no trae el slug: se usa el de la empresa.
  const { agenda, bookingHref: bookingPageHref, tenantSlug: agendaSlug } = usePublicAgenda(isServices || bookingEnabled, company_info.slug)
  const nextSlot = useNextFreeSlot(agendaSlug, Boolean(agenda) && (isServices || bookingEnabled))
  const inlineBooking = bookingEnabled && agenda && agendaSlug && bookingSettings ? bookingSettings : null
  const bookingHref = inlineBooking ? '#reservar' : bookingPageHref
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>()
  const bookService = (serviceId: string) => {
    setBookingServiceId(serviceId)
    document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const serviceMenu = useMemo(
    () => (isServices ? buildServiceMenu(agenda, safeServices, tenantPrefix) : []),
    [isServices, agenda, safeServices, tenantPrefix]
  )

  // Si el dueño cargó banners, mandan ellos; si no, cada plantilla tiene su propia portada
  // armada con sus datos reales (nunca fotos genéricas de otro rubro).
  const configuredSlidesLead = promotionalCarouselVisible || Boolean(settings.promotional_carousel?.slides?.some((slide) => slide.active))
  const renderLead = () => {
    if (isClassic) {
      return heroVisible && (
        <HeroSection
          companyInfo={company_info}
          heroStats={hero_stats}
          heroContent={hero_content}
          brand={brand}
          phoneClean={phoneClean}
          contactHref={contactHref}
          hasRepairs={hasRepairs}
          capabilities={capabilities}
          primaryAction={heroActions.primary}
          tracking={heroActions.tracking}
        />
      )
    }
    if (configuredSlidesLead && settings.promotional_carousel) {
      return (
        <PromotionalCarousel
          settings={{ ...settings.promotional_carousel, enabled: settings.promotional_carousel.enabled ?? true }}
          isPageLead={true}
        />
      )
    }
    if (!heroVisible) return null
    if (storefrontStyle === 'sport') {
      return <SportHero companyInfo={company_info} heroContent={hero_content} contactHref={contactHref} phoneClean={phoneClean} />
    }
    if (isMarket) return <MarketHero companyInfo={company_info} heroContent={hero_content} />
    if (isServices) {
      return (
        <ServicesHero
          companyInfo={company_info}
          heroContent={hero_content}
          bookingHref={bookingHref}
          contactHref={contactHref}
          phoneClean={phoneClean}
          menu={serviceMenu}
          nextSlot={nextSlot}
          onBookNext={inlineBooking ? bookService : undefined}
        />
      )
    }
    return (
      <HeroCampaign
        style={storefrontStyle}
        companyInfo={company_info}
        heroContent={hero_content}
        phoneClean={phoneClean}
        contactHref={contactHref}
        hasRepairs={hasRepairs}
        capabilities={capabilities}
        primaryAction={heroActions.primary}
        tracking={heroActions.tracking}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {!heroVisible && !promotionalCarouselVisible && (
        <h1 className="sr-only">{company_info.name || 'Inicio'}</h1>
      )}

      {/* ── 1. Portada propia de cada plantilla ── */}
      {renderLead()}

      {/* Accesos por público (Mujer, Hombre, Niños): solo Moda y Deportivo. */}
      <StorefrontAudienceLinks />

      {/* En clásico se conserva la ubicación configurable de la barra de beneficios. */}
      {isClassic && trustBarVisible && trustBarPosition === 'above_carousel' && (
        <StoreTrustBar settings={settings.trust_bar} />
      )}

      {isClassic && (
        <PromotionalCarousel
          settings={settings.promotional_carousel}
          isPageLead={!heroVisible && promotionalCarouselVisible}
        />
      )}

      {isClassic && trustBarVisible && trustBarPosition === 'below_carousel' && (
        <StoreTrustBar settings={settings.trust_bar} />
      )}

      {/* Supermercado: beneficios (envío, pagos) bien arriba, antes de los pasillos. */}
      {isMarket && trustBarVisible && <StoreTrustBar settings={settings.trust_bar} className="py-4 sm:py-5" />}

      {Boolean(settings.brands_section?.enabled) && Boolean(settings.brands_section?.showOnHome) && (
        <StoreBrandTicker settings={settings.brands_section} />
      )}

      {isClassic && <CategoryShowcase />}
      {isShowcase && <CategoryCollections style={storefrontStyle} />}

      {isMarket && <MarketAisles />}
      {isMarket && <MarketDeals />}

      {/* Servicios: la carta y el equipo van antes que cualquier producto. */}
      {isServices && <ServiceMenu menu={serviceMenu} bookingHref={bookingHref} onBook={inlineBooking ? bookService : undefined} />}
      {/* Con la reserva en la página, el equipo se muestra dentro de ella. */}
      {isServices && !inlineBooking && <ServiceTeam agenda={agenda} />}
      {isServices && inlineBooking && agenda && (
        <BookingSection settings={inlineBooking} agenda={agenda} slug={agendaSlug} serviceId={bookingServiceId} nextSlot={nextSlot} onBookNext={bookService} />
      )}
      {/* Lo que convence a un cliente nuevo: los trabajos y lo que dicen otros clientes. */}
      {isServices && <ServiceGallery settings={settings.gallery_section} />}
      {isServices && <OrganizationReviews hasRepairs={capabilities.hasRepairs} />}

      {(!isServices || capabilities.hasCatalog) && <FeaturedProducts />}

      {settings.offers_section?.enabled && (
        <StoreOffersPromoShowcase
          companyInfo={company_info}
          tenantPrefix={tenantPrefix}
          tenantSlug={pathTenantSlug || ''}
          phoneClean={phoneClean}
        />
      )}

      {isShowcase && <FashionCampaignBanner phoneClean={phoneClean} />}

      {(isShowcase || isServices) && trustBarVisible && (
        <StoreTrustBar settings={settings.trust_bar} className="py-4 sm:py-5" />
      )}

      {/* En Servicios la carta ya muestra los servicios: no se repite la grilla. */}
      {hasServices && !isServices && <ServicesGrid services={safeServices} />}

      {/* En las demás plantillas la reserva va después del catálogo y los servicios. */}
      {!isServices && inlineBooking && agenda && (
        <BookingSection settings={inlineBooking} agenda={agenda} slug={agendaSlug} serviceId={bookingServiceId} nextSlot={nextSlot} onBookNext={bookService} />
      )}

      {hasProcessSteps && (
        <ProcessSteps
          brand={brand}
          flows={processFlows}
          tenantPrefix={tenantPrefix}
          phoneClean={phoneClean}
        />
      )}

      {branches.length > 0 && <BranchLocations branches={branches} brand={brand} />}

      {isClassic && trustBarVisible && trustBarPosition === 'bottom' && (
        <StoreTrustBar settings={settings.trust_bar} />
      )}

      {!isServices && <OrganizationReviews hasRepairs={capabilities.hasRepairs} />}

      {isServices ? (
        <ServicesLocation companyInfo={company_info} bookingHref={bookingHref} />
      ) : (
        <ContactCTA
          companyInfo={company_info}
          brand={brand}
          phoneClean={phoneClean}
          contactHref={contactHref}
        />
      )}

      <FloatingWhatsAppButton fallbackPhone={phoneClean} />
    </div>
  )
}
