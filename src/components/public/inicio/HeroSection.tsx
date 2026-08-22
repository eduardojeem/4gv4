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

const HERO_BACKGROUNDS: Record<string, string> = {
  blue: 'bg-blue-700',
  green: 'bg-emerald-700',
  purple: 'bg-purple-700',
  orange: 'bg-orange-700',
  red: 'bg-red-700',
  indigo: 'bg-indigo-700',
  teal: 'bg-teal-700',
  rose: 'bg-rose-700',
  amber: 'bg-amber-600',
  emerald: 'bg-emerald-700',
  cyan: 'bg-cyan-700',
  sky: 'bg-sky-700',
  custom: 'bg-primary',
}

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
  const heroBackground = HERO_BACKGROUNDS[companyInfo.brandColor || 'blue'] ?? HERO_BACKGROUNDS.blue

  if (heroContent.enabled === false) return null

  return (
    <section className={cn('relative overflow-hidden border-b border-white/10 py-10 text-white sm:py-14 lg:py-16', heroBackground)}>
      <div className="container">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:gap-16">

          {/* ── Left column: text ── */}
          <div className="flex flex-col items-start">
            {/* Logo if available */}
            {companyInfo.logoUrl && (
              <div className="mb-5 hidden sm:block">
                <Image
                  src={companyInfo.logoUrl}
                  alt={companyInfo.name || 'Logo'}
                  width={64}
                  height={64}
                  className="rounded-lg shadow-lg ring-1 ring-white/20"
                />
              </div>
            )}

            {/* Badge */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/20">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                {heroContent.badge}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 lg:hidden">
                <span className={cn('h-2 w-2 rounded-full', closedToday ? 'bg-slate-300' : 'bg-emerald-300')} />
                {closedToday ? 'Hoy cerrado' : 'Atendemos hoy'}
              </span>
            </div>

            {/* Title */}
            <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              {heroContent.title}
            </h1>

            {/* Subtitle */}
            <p className={`mt-4 max-w-2xl text-base leading-relaxed sm:text-lg ${brand.text200}`}>
              {heroContent.subtitle}
            </p>

            {/* Trust badges */}
            <div className="mt-5 flex flex-wrap gap-2">
              {getTrustBadges(heroContent.trustBadges).map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 rounded-md bg-black/10 px-2.5 py-1.5 text-xs font-medium text-white/85 ring-1 ring-white/15">
                  <Icon className="h-3.5 w-3.5 text-emerald-300" />
                  {label}
                </div>
              ))}
            </div>

            {heroStats.enabled !== false && (
              <div className="mt-5 grid w-full max-w-lg grid-cols-3 divide-x divide-white/15 border-y border-white/15 py-3 lg:hidden">
                <AnimatedStat value={heroStats.repairs} label="Reparaciones" />
                <div className="pl-3"><AnimatedStat value={heroStats.satisfaction} label="Satisfacción" /></div>
                <div className="pl-3"><AnimatedStat value={heroStats.avgTime} label="Tiempo prom." /></div>
              </div>
            )}

            {/* CTAs */}
            <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
              <Button asChild size="lg" className={`rounded-md bg-white px-3 ${brand.ctaBtn} font-bold shadow-lg shadow-black/20 hover:bg-white/90`}>
                <Link href={`${tenantPrefix}/productos`}>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  {heroContent.ctaPrimaryText || 'Ver productos'}
                  <ArrowRight className="ml-2 hidden h-4 w-4 sm:block" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-md border-white/30 bg-black/10 px-3 text-white hover:bg-white/15 hover:text-white">
                <a href={contactHref} target={phoneClean ? '_blank' : undefined} rel={phoneClean ? 'noopener noreferrer' : undefined}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {heroContent.ctaSecondaryText || 'Escribinos'}
                </a>
              </Button>
            </div>

            {/* Repair tracking link */}
            <div className="mt-4 max-w-[calc(100%-4rem)] sm:max-w-none">
              <Link
                href={`${tenantPrefix}/mis-reparaciones`}
                className={`inline-flex items-start gap-1.5 text-sm font-medium leading-snug ${brand.text200} underline-offset-4 transition-colors hover:text-white hover:underline`}
              >
                <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {heroContent.trackRepairText || '¿Tenés una reparación? Rastreá tu equipo'}
              </Link>
            </div>
          </div>

          {/* ── Right column: stats panel ── */}
          <div className="hidden lg:flex lg:justify-end">
            <div className="relative w-full max-w-sm">
              {/* Main stats card */}
              <div className="rounded-lg bg-black/10 p-6 shadow-xl ring-1 ring-white/20">
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
                    className="flex items-center justify-between rounded-md bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <span>Ver catálogo de productos</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`${tenantPrefix}/ofertas`}
                    className="flex items-center justify-between rounded-md bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <span>Ofertas activas</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`${tenantPrefix}/mis-reparaciones`}
                    className="flex items-center justify-between rounded-md bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <span>Rastrear reparación</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Floating badge: estado de atención del día */}
              <div className={cn(
                'absolute -bottom-4 -left-4 flex items-center gap-2 rounded-md px-4 py-2.5 shadow-xl',
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
