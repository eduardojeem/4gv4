'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowRight, MessageCircle, ShoppingBag, Wrench, CheckCircle, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

// ── Animated counter that counts up when in view ───────────────────────────
function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn('transition-all duration-700', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4')}>
      <div className="text-xl font-black text-white tracking-tight whitespace-nowrap">{value}</div>
      <div className="mt-1 text-xs text-white/60 font-medium leading-snug">{label}</div>
    </div>
  )
}

// Suscripción no-op para useSyncExternalStore (el valor solo cambia entre SSR y cliente).
const noopSubscribe = () => () => {}

// ── Trust badges ──────────────────────────────────────────────────────────
const DEFAULT_TRUST_BADGES = [
  { icon: CheckCircle, label: 'Garantía escrita' },
  { icon: Star,         label: 'Repuestos originales' },
  { icon: Wrench,       label: 'Técnicos certificados' },
]

function getTrustBadges(customBadges?: string[]) {
  const labels = customBadges
    ?.map((label) => label.trim())
    .filter(Boolean)
    .map((label) => /^garant[ií]a escrita$/i.test(label) ? 'Garantía escrita' : label) ?? []
  if (labels.length === 0) return DEFAULT_TRUST_BADGES
  const icons = [CheckCircle, Star, Wrench]
  return labels.map((label, i) => ({
    icon: icons[i % icons.length],
    label
  }))
}

export function HeroSection({ companyInfo, heroStats, heroContent, brand, phoneClean, contactHref }: HeroSectionProps) {
  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter(Boolean)
  const tenantPrefix = pathSegments.length > 1 && pathSegments[1] === 'inicio' ? `/${pathSegments[0]}` : ''

  // Estado de atención del día (según horarios de la empresa). Solo-cliente vía
  // useSyncExternalStore: SSR asume "abierto" y el cliente corrige según el día real,
  // sin mismatch de hidratación (el día depende de la zona horaria del visitante).
  const closedToday = useSyncExternalStore(
    noopSubscribe,
    () => {
      const dayIdx = new Date().getDay() // 0=Dom, 6=Sáb
      const todayHours = dayIdx === 0
        ? companyInfo.hours?.sunday
        : dayIdx === 6
          ? companyInfo.hours?.saturday
          : companyInfo.hours?.weekdays
      return !todayHours || /cerrad/i.test(todayHours)
    },
    () => false,
  )

  return (
    <section className={`relative overflow-hidden bg-gradient-to-br ${brand.hero} py-20 text-white md:py-28`}>
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        {/* Dot grid */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hero-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-dots)" />
        </svg>
      </div>

      <div className="container relative">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

          {/* ── Left column: text ── */}
          <div className="flex flex-col items-start">
            {/* Logo if available */}
            {companyInfo.logoUrl && (
              <div className="mb-6">
                <Image
                  src={companyInfo.logoUrl}
                  alt={companyInfo.name || 'Logo'}
                  width={64}
                  height={64}
                  className="rounded-2xl shadow-xl ring-2 ring-white/20"
                />
              </div>
            )}

            {/* Badge */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm ring-1 ring-white/20">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {heroContent.badge}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {heroContent.title}
            </h1>

            {/* Subtitle */}
            <p className={`mt-5 text-lg leading-relaxed ${brand.text200} max-w-lg`}>
              {heroContent.subtitle}
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap gap-3">
              {getTrustBadges(heroContent.trustBadges).map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 ring-1 ring-white/15 backdrop-blur-sm">
                  <Icon className="h-3.5 w-3.5 text-emerald-300" />
                  {label}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className={`rounded-xl bg-white ${brand.ctaBtn} font-bold shadow-lg shadow-black/20 hover:bg-white/90`}>
                <Link href={`${tenantPrefix}/productos`}>
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  {heroContent.ctaPrimaryText || 'Ver productos'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20">
                <a href={contactHref} target={phoneClean ? '_blank' : undefined} rel={phoneClean ? 'noopener noreferrer' : undefined}>
                  <MessageCircle className="mr-2 h-5 w-5" />
                  {heroContent.ctaSecondaryText || 'Escribinos'}
                </a>
              </Button>
            </div>

            {/* Repair tracking link */}
            <div className="mt-5">
              <Link
                href={`${tenantPrefix}/mis-reparaciones`}
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${brand.text200} underline-offset-4 transition-colors hover:text-white hover:underline`}
              >
                <Wrench className="h-3.5 w-3.5" />
                {heroContent.trackRepairText || '¿Tenés una reparación? Rastreá tu equipo'}
              </Link>
            </div>
          </div>

          {/* ── Right column: stats panel ── */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-sm">
              {/* Main stats card */}
              <div className="relative overflow-hidden rounded-3xl bg-white/10 p-8 shadow-2xl ring-1 ring-white/20 backdrop-blur-md">
                {/* Inner glow */}
                <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

                {/* Stats grid */}
                {heroStats.enabled !== false && (
                  <div className="grid grid-cols-3 gap-3 border-b border-white/15 pb-6">
                    <AnimatedStat value={heroStats.repairs}      label="Reparaciones" />
                    <AnimatedStat value={heroStats.satisfaction} label="Satisfacción"  />
                    <AnimatedStat value={heroStats.avgTime}      label="Tiempo prom."  />
                  </div>
                )}

                {/* Quick links */}
                <div className={`space-y-3 ${heroStats.enabled !== false ? 'mt-6' : ''}`}>
                  <Link
                    href={`${tenantPrefix}/productos`}
                    className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <span>Ver catálogo de productos</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`${tenantPrefix}/ofertas`}
                    className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <span>Ofertas activas</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`${tenantPrefix}/mis-reparaciones`}
                    className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <span>Rastrear reparación</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Floating badge: estado de atención del día */}
              <div className={cn(
                'absolute -bottom-4 -left-4 flex items-center gap-2 rounded-2xl px-4 py-2.5 shadow-xl',
                closedToday ? 'bg-slate-600 shadow-slate-900/30' : 'bg-emerald-500 shadow-emerald-900/30'
              )}>
                <span className={cn('flex h-2 w-2 rounded-full bg-white', !closedToday && 'animate-pulse')} />
                <span className="text-sm font-bold text-white">{closedToday ? 'Hoy cerrado' : 'Atendemos hoy'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
