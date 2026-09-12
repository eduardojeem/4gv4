'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
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
import { FloatingWhatsAppButton } from '@/components/public/FloatingWhatsAppButton'
import { useStorefrontStyle } from '@/components/public/storefront-style-context'
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

  const effectivePromotionalCarousel = useMemo(() => {
    const existing = settings.promotional_carousel
    const hasConfiguredSlides = Array.isArray(existing?.slides) && existing.slides.length > 0
    const hasActiveSlides = hasConfiguredSlides && existing.slides.some((s) => s.active)

    // Si la organización ya configuró y guardó diapositivas en su panel:
    if (hasActiveSlides) {
      return {
        ...existing,
        // Si tiene diapositivas activas pero el toggle general quedó en false por defecto,
        // aseguramos que se muestren las imágenes que el usuario configuró
        enabled: existing.enabled ?? true,
      }
    }

    // Si la tienda es de indumentaria / moda y todavía no configuró ningún banner propio,
    // mostramos banners de cortesía de moda a pantalla completa
    if (storefrontStyle !== 'classic' && !hasConfiguredSlides) {
      return {
        enabled: true,
        autoplay: true,
        intervalSeconds: 6,
        layoutMode: 'full' as const,
        tone: 'dark' as const,
        slides: [
          {
            id: 'slide-dabasica-1',
            active: true,
            title: hero_content.title || 'Nueva Colección 2026',
            message: hero_content.subtitle || 'Prendas de alta calidad, últimas tendencias y envíos a todo el país.',
            ctaText: hero_content.ctaPrimaryText || 'Ver Ofertas',
            ctaHref: heroActions.primary.href ? `${tenantPrefix}${heroActions.primary.href}` : `${tenantPrefix}/inicio#contacto`,
            imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1920&auto=format&fit=crop',
            imageAlt: hero_content.title || 'Nueva Colección 2026',
            contentAlign: 'right' as const,
            textTone: 'light' as const,
          },
          {
            id: 'slide-dabasica-2',
            active: true,
            title: 'Moda Deportiva & Casual',
            message: 'Las mejores marcas con el máximo confort para toda la familia.',
            ctaText: 'Explorar catálogo',
            ctaHref: heroActions.primary.href ? `${tenantPrefix}${heroActions.primary.href}` : `${tenantPrefix}/inicio#contacto`,
            imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1920&auto=format&fit=crop',
            imageAlt: 'Moda Deportiva & Casual',
            contentAlign: 'right' as const,
            textTone: 'light' as const,
          },
          {
            id: 'slide-dabasica-3',
            active: true,
            title: 'Básicos con Calidad Garantizada',
            message: 'Remeras, buzos y complementos esenciales al mejor precio.',
            ctaText: 'Comprar ahora',
            ctaHref: heroActions.primary.href ? `${tenantPrefix}${heroActions.primary.href}` : `${tenantPrefix}/inicio#contacto`,
            imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1920&auto=format&fit=crop',
            imageAlt: 'Básicos con Calidad Garantizada',
            contentAlign: 'right' as const,
            textTone: 'light' as const,
          },
        ],
      }
    }
    return existing
  }, [settings.promotional_carousel, storefrontStyle, hero_content, tenantPrefix, heroActions.primary.href])

  const brand = getBrandTheme(company_info.brandColor)
  const heroVisible = hero_content.enabled !== false
  const promotionalCarouselVisible = Boolean(
    settings.promotional_carousel?.enabled &&
      settings.promotional_carousel.slides.some((slide) => slide.active)
  )

  const trustBarPosition = settings.trust_bar?.position || 'above_carousel'
  const trustBarVisible = settings.trust_bar?.enabled !== false

  return (
    <div className="flex flex-col min-h-screen">
      {!heroVisible && !promotionalCarouselVisible && (
        <h1 className="sr-only">{company_info.name || 'Inicio'}</h1>
      )}

      {/* ── 1. Portada / Carrusel Principal ── */}
      {storefrontStyle !== 'classic' ? (
        <PromotionalCarousel
          settings={effectivePromotionalCarousel}
          isPageLead={true}
        />
      ) : (
        heroVisible && (
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
      )}

      {/* Accesos de compra inmediatos para tiendas de moda y deporte. */}
      <StorefrontAudienceLinks />

      {/* En clásico se conserva la ubicación configurable; moda/deporte usan una jerarquía más comercial. */}
      {storefrontStyle === 'classic' && trustBarVisible && trustBarPosition === 'above_carousel' && (
        <StoreTrustBar settings={settings.trust_bar} />
      )}

      {/* ── 3. Banners Promocionales (Modo Clásico) ── */}
      {storefrontStyle === 'classic' && (
        <PromotionalCarousel
          settings={settings.promotional_carousel}
          isPageLead={!heroVisible && promotionalCarouselVisible}
        />
      )}

      {/* ── 3.1 Barra de Beneficios (Modo Clásico si está configurada DEBAJO) ── */}
      {storefrontStyle === 'classic' && trustBarVisible && trustBarPosition === 'below_carousel' && (
        <StoreTrustBar settings={settings.trust_bar} />
      )}

      {/* ── 3.2 Marquesina de Marcas Animada (Estilo Giulio Cesare) ── */}
      {storefrontStyle !== 'classic' && (
        <StoreBrandTicker settings={settings.brands_section} />
      )}

      {/* Las categorías editoriales se conservan solo en el aspecto clásico;
          en moda/deporte los accesos por público evitan navegación duplicada. */}
      {storefrontStyle === 'classic' && <CategoryShowcase />}

      {/* Productos antes de campañas secundarias: el usuario llega antes al catálogo. */}
      <FeaturedProducts />

      {/* Ofertas y campaña secundaria aparecen después del primer bloque comprable. */}
      {settings.offers_section?.enabled && (
        <div id="ofertas">
          <OffersCarousel
            companyName={company_info.name || 'Tienda'}
            settings={settings.offers_section}
          />
        </div>
      )}

      {storefrontStyle !== 'classic' && (
        <FashionCampaignBanner phoneClean={phoneClean} />
      )}

      {storefrontStyle !== 'classic' && trustBarVisible && (
        <StoreTrustBar settings={settings.trust_bar} className="py-4 sm:py-5" />
      )}

      {/* ── 7. Servicios Técnicos (SÓLO si la empresa los ofrece y tiene activos) ── */}
      {hasServices && <ServicesGrid services={safeServices} />}

      {/* ── 8. Pasos del Proceso (SÓLO si la empresa los tiene habilitados y configurados) ── */}
      {hasProcessSteps && (
        <ProcessSteps brand={brand} flows={processFlows} />
      )}

      {/* ── 9. Sucursales de la Tienda ── */}
      {branches.length > 0 && <BranchLocations branches={branches} brand={brand} />}

      {/* ── 9.1 Barra de Beneficios (Si está configurada AL PIE DE PÁGINA) ── */}
      {storefrontStyle === 'classic' && trustBarVisible && trustBarPosition === 'bottom' && (
        <StoreTrustBar settings={settings.trust_bar} />
      )}

      {/* ── 10. Reseñas y Opiniones de Clientes ── */}
      <OrganizationReviews />

      {/* ── 11. Centro de Contacto y Asesoramiento WhatsApp ── */}
      <ContactCTA
        companyInfo={company_info}
        brand={brand}
        phoneClean={phoneClean}
        contactHref={contactHref}
      />

      {/* ── 12. Botón Flotante Oficial de WhatsApp ── */}
      <FloatingWhatsAppButton fallbackPhone={phoneClean} />
    </div>
  )
}
