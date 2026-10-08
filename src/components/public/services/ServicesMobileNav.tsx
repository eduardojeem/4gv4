'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck2, Home, MapPin, MessageCircle, Scissors } from 'lucide-react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useHydrated } from '@/hooks/use-hydrated'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { usePublicAgenda } from '@/components/public/inicio/ServicesHome'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'

const TAB = 'group flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground select-none'

/**
 * Barra inferior en celulares para la plantilla «Servicios»: lo que busca el
 * cliente de una peluquería es reservar, ver precios, llegar y escribir.
 */
export function ServicesMobileNav({ initialSettings = null }: { initialSettings?: WebsiteSettings | null }) {
  const pathname = usePathname()
  const { settings } = useWebsiteSettings()
  const effectiveSettings = settings ?? initialSettings
  const companyInfo = useStorefrontCompanyInfo(effectiveSettings?.company_info)
  const pathSlug = getTenantSlugFromPathname(pathname)
  const prefix = pathSlug ? `/${pathSlug}` : ''
  const agendaState = usePublicAgenda(true, companyInfo?.slug)
  // La agenda sale de la caché del navegador: hasta hidratar se dibuja lo mismo
  // que en el servidor (si no, «Reservar» y «Pedir turno» no coincidían).
  const hydrated = useHydrated()
  const agenda = hydrated ? agendaState.agenda : null

  const whatsapp = (companyInfo?.whatsapp || companyInfo?.phone || '').replace(/\D/g, '')
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp}` : null
  const mapsHref = companyInfo?.mapsUrl?.trim()
    || (companyInfo?.address?.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyInfo.address.trim())}` : null)
  const bookingHref = agenda
    ? effectiveSettings?.booking_section?.enabled ? `${prefix}/inicio#reservar` : `${prefix}/turnos`
    : whatsappHref
  const homeActive = pathname === `${prefix}/inicio` || pathname === prefix || pathname === '/'

  return (
    <nav
      aria-label="Accesos rápidos"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-end justify-around border-t border-border/80 bg-background px-2 pb-1 shadow-lg lg:hidden"
    >
      <Link href={`${prefix}/inicio`} aria-current={homeActive ? 'page' : undefined} className={cn(TAB, homeActive && 'text-primary')}>
        <Home aria-hidden="true" className="h-5 w-5" />
        Inicio
      </Link>
      <Link href={`${prefix}/inicio#servicios`} className={TAB}>
        <Scissors aria-hidden="true" className="h-5 w-5" />
        Servicios
      </Link>

      {bookingHref ? (
        <Link
          href={bookingHref}
          target={agenda ? undefined : '_blank'}
          className="flex flex-1 flex-col items-center gap-1 text-[10px] font-bold text-primary focus-visible:outline-none"
        >
          <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background">
            <CalendarCheck2 aria-hidden="true" className="h-6 w-6" />
          </span>
          {/* Sin reservas online el turno se pide por WhatsApp. */}
          {agenda ? 'Reservar' : 'Pedir turno'}
        </Link>
      ) : (
        <span className="flex-1" />
      )}

      {mapsHref ? (
        <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={TAB}>
          <MapPin aria-hidden="true" className="h-5 w-5" />
          Cómo llegar
        </a>
      ) : (
        <Link href={`${prefix}/inicio#contacto`} className={TAB}>
          <MapPin aria-hidden="true" className="h-5 w-5" />
          Contacto
        </Link>
      )}
      {whatsappHref ? (
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={TAB}>
          <MessageCircle aria-hidden="true" className="h-5 w-5 text-[#25D366]" />
          WhatsApp
        </a>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  )
}
