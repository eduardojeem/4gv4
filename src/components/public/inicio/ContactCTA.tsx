'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, MessageCircle, Phone, Mail, MapPin, Clock, ExternalLink, ShieldCheck, Sparkles, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CompanyInfo } from '@/types/website-settings'
import type { BrandTheme } from '@/lib/constants/brand-theme'
import { getCompanyMapsHref } from '@/lib/website/company-maps-url'
import { cn } from '@/lib/utils'

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
      label: 'Llamadas & Atención',
      value: companyInfo.phone,
      href: `tel:${(companyInfo.phone || '').replace(/\D/g, '')}`,
    },
    companyInfo.email && {
      icon: Mail,
      label: 'Correo Electrónico',
      value: companyInfo.email,
      href: `mailto:${companyInfo.email}`,
    },
    (companyInfo.address || mapsHref) && {
      icon: MapPin,
      label: 'Local y Dirección',
      value: companyInfo.address || 'Ver ubicación en Google Maps',
      href: mapsHref,
    },
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; value: string; href: string | null }>

  const hourRows = [
    ['Lun - Vie', companyInfo.hours?.weekdays],
    ['Sábado', companyInfo.hours?.saturday],
    ['Domingo', companyInfo.hours?.sunday],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  const cleanHourValue = (value: string) =>
    value.replace(/^(lun(?:es)?\s*-?\s*vie(?:rnes)?|s[aá]b(?:ado)?|dom(?:ingo)?)\s*:\s*/i, '').trim()

  return (
    <section id="contacto" aria-labelledby="contact-title" className="py-14 sm:py-20 bg-background border-t border-border/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Tarjeta Principal de Atención al Cliente */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/30 p-8 sm:p-12 shadow-lg">
          
          <div className="mx-auto max-w-3xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Atención Directa & Ventas</span>
            </div>

            <h2 id="contact-title" className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              ¿Tenés dudas o querés hacer un pedido?
            </h2>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Comunicate con nosotros para consultar stock, medios de pago, envíos o asesoramiento técnico en el acto.
            </p>

            {/* Botones de Acción */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20 gap-2"
              >
                <a
                  href={contactHref}
                  target={phoneClean ? '_blank' : undefined}
                  rel={phoneClean ? 'noopener noreferrer' : undefined}
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>{phoneClean ? 'Escribir por WhatsApp' : 'Contactar por Email'}</span>
                </a>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-xl border-border bg-background font-bold text-foreground hover:bg-muted shadow-xs gap-2"
              >
                <Link href={`${tenantPrefix}/productos`}>
                  <Store className="h-4 w-4 text-primary" />
                  <span>Explorar Catálogo</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Tarjetas de Información de Contacto */}
          {(contactItems.length > 0 || hourRows.length > 0) && (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-8 border-t border-border/60">
              {contactItems.map(({ icon: Icon, label, value, href }) => (
                <div
                  key={label}
                  className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-background/80 p-4 transition-all hover:border-primary/40 hover:shadow-xs"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                    {href ? (
                      <a
                        href={href}
                        target={label === 'Local y Dirección' ? '_blank' : undefined}
                        rel={label === 'Local y Dirección' ? 'noopener noreferrer' : undefined}
                        className="mt-1 block text-xs font-semibold text-foreground hover:text-primary transition-colors truncate"
                      >
                        {value}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-foreground truncate">{value}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Horarios */}
              {hourRows.length > 0 && (
                <div className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-background/80 p-4 transition-all hover:border-primary/40 hover:shadow-xs">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Horarios</p>
                    <ul className="mt-1 space-y-1">
                      {hourRows.map(([day, val]) => (
                        <li key={day} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{day}:</span>
                          <span className="font-semibold text-foreground">{cleanHourValue(val)}</span>
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
