'use client'
import type { CSSProperties } from 'react'
import { ServicesHero, buildServiceMenu, type PublicAgendaInfo } from '@/components/public/inicio/ServicesHome'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { ServiceWebsiteProposal } from '@/lib/website/service-website-proposal'
import type { Service } from '@/types/website-settings'

export function ServiceWebsiteProposalPreview({ proposal, services, agenda = null }: { proposal: ServiceWebsiteProposal; services: Service[]; agenda?: PublicAgendaInfo | null }) {
  const settings = applyWebsiteSettingsDefaults(proposal.values)
  const menu = buildServiceMenu(agenda, services, '')
  const bookingHref = agenda ? settings.booking_section.enabled ? '#reservar' : '/turnos' : null
  return <div className="overflow-hidden rounded-lg border" aria-label="Vista previa de la página de servicios"
    data-custom-brand="" style={{ '--brand-primary': settings.company_info.customBrandColor } as CSSProperties}
    onClickCapture={event => event.preventDefault()}>
    <StorefrontStyleProvider style="services">
      <ServicesHero companyInfo={settings.company_info} heroContent={settings.hero_content} menu={menu}
        bookingHref={bookingHref} contactHref="#" phoneClean="" />
    </StorefrontStyleProvider>
    {menu.length === 0 && <p className="p-4 text-sm text-muted-foreground">Todavía no hay servicios publicados en el sitio. Configuralos en Servicios y verificá tu agenda antes de recibir reservas.</p>}
    <p className="border-t p-3 text-xs text-muted-foreground">Vista previa de la portada, sin reservas ni enlaces activos. Se muestra el menú real de la agenda pública cuando está disponible, o los servicios del sitio. La disponibilidad se consulta al reservar.</p>
  </div>
}
