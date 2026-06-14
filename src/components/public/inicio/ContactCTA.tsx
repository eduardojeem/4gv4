'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, MessageCircle, Phone, Mail, MapPin, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CompanyInfo } from '@/types/website-settings'
import type { BrandTheme } from '@/lib/constants/brand-theme'

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
    companyInfo.address && {
      icon: MapPin,
      label: 'Dirección',
      value: companyInfo.address,
      href: null,
    },
    // Hours are handled separately below as a multi-line card
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; value: string; href: string | null }>

  return (
    <section id="contacto" className={`relative overflow-hidden border-t bg-gradient-to-br ${brand.cta} py-16 text-white md:py-24`}>
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
      </div>

      <div className="container relative">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ¿Listo para reparar tu celular?
          </h2>
          <p className={`mt-4 text-lg ${brand.ctaText}`}>
            Visitanos o contáctanos para un diagnóstico gratuito
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className={`rounded-xl bg-white ${brand.ctaBtn} font-bold shadow-lg shadow-black/20 hover:bg-white/90`}>
              <Link href={`${tenantPrefix}/mis-reparaciones`}>
                Rastrear mi reparación
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20">
              <a href={contactHref} target={phoneClean ? '_blank' : undefined} rel={phoneClean ? 'noopener noreferrer' : undefined}>
                <MessageCircle className="mr-2 h-5 w-5" />
                Escribinos
              </a>
            </Button>
          </div>

          {/* Contact info + hours — only rendered for non-empty fields */}
          {(contactItems.length > 0 || companyInfo.hours?.weekdays) && (
            <div className="mt-14 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
              {/* Simple contact items */}
              {contactItems.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${brand.text300}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{label}</p>
                    {href ? (
                      <a href={href} className="mt-1 block truncate text-sm font-medium text-white hover:underline">
                        {value}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-white/90 leading-snug">{value}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Hours card — shows all three days */}
              {companyInfo.hours?.weekdays && (
                <div className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm sm:col-span-2 lg:col-span-1">
                  <Clock className={`mt-0.5 h-5 w-5 shrink-0 ${brand.text300}`} />
                  <div className="min-w-0 w-full">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Horarios</p>
                    <ul className="mt-1.5 space-y-1">
                      {companyInfo.hours.weekdays && (
                        <li className="flex justify-between gap-2 text-sm">
                          <span className="text-white/60">Lun – Vie</span>
                          <span className="font-medium text-white">{companyInfo.hours.weekdays}</span>
                        </li>
                      )}
                      {companyInfo.hours.saturday && (
                        <li className="flex justify-between gap-2 text-sm">
                          <span className="text-white/60">Sábado</span>
                          <span className="font-medium text-white">{companyInfo.hours.saturday}</span>
                        </li>
                      )}
                      {companyInfo.hours.sunday && (
                        <li className="flex justify-between gap-2 text-sm">
                          <span className="text-white/60">Domingo</span>
                          <span className="font-medium text-white">{companyInfo.hours.sunday}</span>
                        </li>
                      )}
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
