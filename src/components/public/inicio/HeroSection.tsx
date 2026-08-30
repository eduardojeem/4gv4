'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle,
  MessageCircle,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
  Wrench,
  CreditCard,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { isPublicRepairsAvailable } from '@/lib/website/services'
import type { CompanyInfo, HeroStats, HeroContent } from '@/types/website-settings'
import type { BrandTheme } from '@/lib/constants/brand-theme'

interface HeroSectionProps {
  companyInfo: CompanyInfo
  heroStats: HeroStats
  heroContent: HeroContent
  brand: BrandTheme
  phoneClean: string
  contactHref: string
  hasRepairs?: boolean
}

function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      )}
    >
      <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-muted-foreground leading-tight">
        {label}
      </div>
    </div>
  )
}

const noopSubscribe = () => () => {}

export function HeroSection({
  companyInfo,
  heroStats,
  heroContent,
  brand,
  phoneClean,
  contactHref,
  hasRepairs = false,
}: HeroSectionProps) {
  const pathname = usePathname()
  const router = useRouter()
  const pathSegments = pathname.split('/').filter(Boolean)
  const tenantPrefix =
    pathSegments.length > 1 && pathSegments[1] === 'inicio' ? `/${pathSegments[0]}` : ''

  const [searchQuery, setSearchQuery] = useState('')

  const closedToday = useSyncExternalStore(
    noopSubscribe,
    () => {
      const dayIdx = new Date().getDay()
      const todayHours =
        dayIdx === 0
          ? companyInfo.hours?.sunday
          : dayIdx === 6
          ? companyInfo.hours?.saturday
          : companyInfo.hours?.weekdays
      return !todayHours || /cerrad/i.test(todayHours)
    },
    () => false
  )

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`${tenantPrefix}/productos?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push(`${tenantPrefix}/productos`)
    }
  }

  if (heroContent.enabled === false) return null

  return (
    <section className="relative overflow-hidden border-b border-border/80 bg-gradient-to-b from-primary/[0.06] via-background to-background py-10 sm:py-16 lg:py-20">
      {/* Luces de ambiente sutiles */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          
          {/* ── Columna Izquierda: Mensaje Comercial y Búsqueda ── */}
          <div className="flex flex-col items-start lg:col-span-7">
            
            {/* Badges superiores: Estado & Tienda */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                {heroContent.badge || 'Catálogo Oficial'}
              </span>

              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                  closedToday
                    ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    closedToday ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                  )}
                />
                {closedToday ? 'Cerrado hoy' : 'Abierto hoy'}
              </span>
            </div>

            {/* Título Principal */}
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-[1.15]">
              {heroContent.title || 'Los mejores productos al mejor precio'}
            </h1>

            {/* Subtítulo */}
            <p className="mt-3.5 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
              {heroContent.subtitle ||
                'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y atención personalizada.'}
            </p>

            {/* ── Buscador Directo en el Hero ── */}
            <form
              onSubmit={handleSearchSubmit}
              className="mt-6 flex w-full max-w-lg items-center gap-2 rounded-2xl border border-border/80 bg-card p-1.5 shadow-md focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="¿Qué estás buscando hoy?..."
                  className="h-10 border-0 bg-transparent pl-9 pr-3 text-xs sm:text-sm focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/70"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="h-10 rounded-xl px-4 font-bold shadow-xs gap-1.5"
              >
                <span>Buscar</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>

            {/* CTAs Principales */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-xl font-bold shadow-sm gap-2">
                <Link href={`${tenantPrefix}/productos`}>
                  <ShoppingBag className="h-4 w-4" />
                  {heroContent.ctaPrimaryText || 'Explorar productos'}
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl border-border bg-card font-semibold text-foreground hover:bg-muted shadow-xs gap-2"
              >
                <a
                  href={contactHref}
                  target={phoneClean ? '_blank' : undefined}
                  rel={phoneClean ? 'noopener noreferrer' : undefined}
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {heroContent.ctaSecondaryText || 'Contactar por WhatsApp'}
                </a>
              </Button>
            </div>

            {/* Rastrear reparación u orden de compra */}
            <div className="mt-4">
              {hasRepairs ? (
                <Link
                  href={`${tenantPrefix}/mis-reparaciones`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Wrench className="h-3.5 w-3.5 text-primary" />
                  <span>{heroContent.trackRepairText || '¿Tenés una orden técnica? Rastreá tu equipo aquí'}</span>
                  <ArrowRight className="h-3 w-3 opacity-60" />
                </Link>
              ) : (
                <Link
                  href={`${tenantPrefix}/track`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  <span>¿Hiciste una compra? Rastreá el estado de tu pedido aquí</span>
                  <ArrowRight className="h-3 w-3 opacity-60" />
                </Link>
              )}
            </div>
          </div>

          {/* ── Columna Derecha: Tarjeta Comercial Destacada ── */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              {/* Tarjeta de Resumen Comercial */}
              <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-xl space-y-6">
                
                {/* Logo e Identidad de la Tienda */}
                <div className="flex items-center gap-3.5 pb-4 border-b border-border/60">
                  {companyInfo.logoUrl ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-background p-1 shadow-xs">
                      <Image
                        src={companyInfo.logoUrl}
                        alt={companyInfo.name || 'Logo'}
                        fill
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-sm shadow-xs">
                      {companyInfo.name?.slice(0, 2).toUpperCase() || '4G'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold text-base text-foreground">
                      {companyInfo.name || 'Tienda Oficial'}
                    </h2>
                    <p className="truncate text-xs text-muted-foreground">
                      {companyInfo.address || 'Atención personalizada y envíos'}
                    </p>
                  </div>
                </div>

                {/* Estadísticas de Confianza */}
                {heroStats.enabled !== false && (
                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-3.5 text-center border border-border/40">
                    <AnimatedStat value={heroStats.repairs || '100%'} label="Garantía" />
                    <AnimatedStat value={heroStats.satisfaction || '4.9★'} label="Valoración" />
                    <AnimatedStat value={heroStats.avgTime || '24h'} label="Despacho" />
                  </div>
                )}

                {/* Accesos Rápidos de Compra */}
                <div className="space-y-2">
                  <Link
                    href={`${tenantPrefix}/productos`}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-background p-3 text-xs font-bold text-foreground transition-all hover:border-primary/50 hover:bg-muted/50 hover:shadow-xs group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Package className="h-4 w-4" />
                      </div>
                      <span>Ver catálogo completo de productos</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </Link>

                  <Link
                    href={`${tenantPrefix}/productos?ofertas=true`}
                    className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs font-bold text-rose-800 transition-all hover:bg-rose-100/70 hover:shadow-xs group dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-200 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <span>Promociones y ofertas especiales</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-rose-500 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>

                {/* Badge Inferior de Horarios */}
                <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground border-t border-border/60">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Horario de atención:
                  </span>
                  <span className="font-semibold text-foreground">
                    {companyInfo.hours?.weekdays || 'Lunes a Sábados'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
