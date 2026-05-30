'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CompanyInfo, HeroStats, HeroContent } from '@/types/website-settings'
import type { BrandTheme } from '@/lib/constants/brand-theme'

interface HeroSectionProps {
  companyInfo: CompanyInfo
  heroStats: HeroStats
  heroContent: HeroContent
  brand: BrandTheme
  phoneClean: string
  contactHref: string
}

export function HeroSection({ companyInfo, heroStats, heroContent, brand, phoneClean, contactHref }: HeroSectionProps) {
  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter(Boolean)
  const tenantPrefix = pathSegments.length > 1 && pathSegments[1] === 'inicio' ? `/${pathSegments[0]}` : ''

  return (
    <section className={`relative overflow-hidden bg-gradient-to-br ${brand.hero} py-20 text-white md:py-32`}>
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
      <div className="container relative">
        <div className="mx-auto max-w-4xl text-center">
          {companyInfo.logoUrl && (
            <div className="mb-6 flex justify-center">
              <Image src={companyInfo.logoUrl} alt={companyInfo.name || 'Logo'} width={72} height={72} className="rounded-xl shadow-lg" />
            </div>
          )}
          <div className="mb-6 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
            {heroContent.badge}
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            {heroContent.title}
          </h1>
          <p className={`mt-6 text-lg ${brand.text200} sm:text-xl`}>
            {heroContent.subtitle}
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className={`bg-white ${brand.ctaBtn} hover:bg-white/90`}>
              <Link href={`${tenantPrefix}/mis-reparaciones`}>
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

          {/* Stats */}
          <div className="mt-16 grid gap-8 text-center sm:grid-cols-3">
            <div>
              <div className="text-4xl font-bold">{heroStats.repairs}</div>
              <div className={`mt-1 text-sm ${brand.text200}`}>Reparaciones realizadas</div>
            </div>
            <div>
              <div className="text-4xl font-bold">{heroStats.satisfaction}</div>
              <div className={`mt-1 text-sm ${brand.text200}`}>Clientes satisfechos</div>
            </div>
            <div>
              <div className="text-4xl font-bold">{heroStats.avgTime}</div>
              <div className={`mt-1 text-sm ${brand.text200}`}>Tiempo promedio</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
