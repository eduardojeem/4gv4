'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, MessageCircle, Phone, Mail, MapPin, Clock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CompanyInfo } from '@/types/website-settings'
import type { BrandTheme } from '@/lib/constants/brand-theme'
import { getCompanyMapsHref } from '@/lib/website/company-maps-url'

interface ContactCTAProps {
  companyInfo: CompanyInfo
  brand: BrandTheme
  phoneClean: string
  contactHref: string
}

export function ContactCTA({ companyInfo, brand, phoneClean, contactHref }: ContactCTAProps) {
  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter(Boolean)
  const tenantPrefix = pathSegments.length > 1 && pathSegments[1] === 'inicio' ? `/${pathSegments[0]}` : ''
  const mapsHref = getCompanyMapsHref(companyInfo.mapsUrl, companyInfo.address)

  const contactItems = [
    companyInfo.phone && {
      icon: Phone,
      label: 'Teléfono',
      value: companyInfo.phone,
      href: `tel:${(companyInfo.phone || '').replace(/\D/g, '')}`,
    },
    companyInfo.email && {
      icon: Mail,
      label: 'Email',
      value: companyInfo.email,
      href: `mailto:${companyInfo.email}`,
    },
    (companyInfo.address || mapsHref) && {
      icon: MapPin,
      label: 'Dirección',
      value: companyInfo.address || 'Ver ubicación en Google Maps',
      href: mapsHref,
    },
    // Hours are handled separately below as a multi-line card
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; value: string; href: string | null }>

  const hourRows = [
    ['Lun - Vie', companyInfo.hours?.weekdays],
    ['Sábado', companyInfo.hours?.saturday],
    ['Domingo', companyInfo.hours?.sunday],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  const cleanHourValue = (value: string) =>
    value.replace(/^(lun(?:es)?\s*-?\s*vie(?:rnes)?|s[aá]b(?:ado)?|dom(?:ingo)?)\s*:\s*/i, '').trim()

  return (
    <section id="contacto" aria-labelledby="contact-title" className="border-t bg-zinc-950 py-14 text-white md:py-20">
      <div className="container">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-semibold text-white/55">Contacto y ubicación</p>
          <h2 id="contact-title" className="mt-3 text-3xl font-bold sm:text-4xl">
            ¿Necesitás ayuda con tu equipo?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            Consultá disponibilidad, solicitá asistencia o coordiná tu visita al local.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className={`rounded-md bg-white ${brand.ctaBtn} font-semibold hover:bg-white/90`}>
              <Link href={`${tenantPrefix}/mis-reparaciones`}>
                Rastrear mi reparación
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-md border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <a href={contactHref} target={phoneClean ? '_blank' : undefined} rel={phoneClean ? 'noopener noreferrer' : undefined}>
                {phoneClean
                  ? <MessageCircle className="mr-2 h-5 w-5" />
                  : <Mail className="mr-2 h-5 w-5" />}
                {phoneClean ? 'Escribir por WhatsApp' : 'Enviar un email'}
              </a>
            </Button>
          </div>

          {/* Contact info + hours — only rendered for non-empty fields */}
          {(contactItems.length > 0 || hourRows.length > 0) && (
            <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 text-left sm:grid-cols-2 lg:grid-cols-4">
              {/* Simple contact items */}
              {contactItems.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex min-h-32 items-start gap-3 bg-zinc-950 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10">
                    <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white/50">{label}</p>
                    {href ? (
                      <a
                        href={href}
                        target={label === 'Dirección' ? '_blank' : undefined}
                        rel={label === 'Dirección' ? 'noopener noreferrer' : undefined}
                        className="mt-2 block break-words text-sm font-medium leading-relaxed text-white hover:text-white/75"
                      >
                        {value}
                        {label === 'Dirección' && (
                          <span className="mt-1.5 flex items-center gap-1 text-xs font-normal text-white/50">
                            Cómo llegar <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </span>
                        )}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-white/90 leading-snug">{value}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Hours card — shows all three days */}
              {hourRows.length > 0 && (
                <div className="flex min-h-32 items-start gap-3 bg-zinc-950 p-5 sm:col-span-2 lg:col-span-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10">
                    <Clock className="h-4 w-4 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-xs font-semibold text-white/50">Horarios</p>
                    <ul className="mt-2 space-y-1.5">
                      {hourRows.map(([day, value]) => (
                        <li key={day} className="flex justify-between gap-3 text-xs">
                          <span className="text-white/50">{day}</span>
                          <span className="text-right font-medium text-white">{cleanHourValue(value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
