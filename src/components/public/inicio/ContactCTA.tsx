'use client'

import Link from 'next/link'
import { ArrowRight, MessageCircle, Phone, Mail, MapPin } from 'lucide-react'
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
  return (
    <section id="contacto" className={`border-t bg-gradient-to-br ${brand.cta} py-16 text-white md:py-24`}>
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ¿Listo para reparar tu celular?
          </h2>
          <p className={`mt-4 text-lg ${brand.ctaText}`}>
            Visítanos o contáctanos para un diagnóstico gratuito
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className={`bg-white ${brand.ctaBtn} hover:bg-white/90`}>
              <Link href="/mis-reparaciones">
                Rastrear mi reparación
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              <a href={contactHref} target={phoneClean ? "_blank" : undefined} rel={phoneClean ? "noopener noreferrer" : undefined}>
                <MessageCircle className="mr-2 h-5 w-5" />
                Escribinos
              </a>
            </Button>
          </div>

          {/* Contact info */}
          <div className="mt-16 grid gap-8 text-left sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <Phone className={`h-5 w-5 ${brand.text300}`} />
              <div>
                <p className="font-semibold">Teléfono</p>
                <p className={`mt-1 text-sm ${brand.text200}`}>{companyInfo.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className={`h-5 w-5 ${brand.text300}`} />
              <div>
                <p className="font-semibold">Email</p>
                <p className={`mt-1 text-sm ${brand.text200}`}>{companyInfo.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className={`h-5 w-5 ${brand.text300}`} />
              <div>
                <p className="font-semibold">Ubicación</p>
                <p className={`mt-1 text-sm ${brand.text200}`}>{companyInfo.address}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
