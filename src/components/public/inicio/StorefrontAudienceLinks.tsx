'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, BadgePercent, Baby, PersonStanding, UserRound } from 'lucide-react'

import { useStorefrontStyle } from '@/components/public/storefront-style-context'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'

const SHOPPING_PATHS = [
  {
    label: 'Mujer',
    description: 'Prendas, calzados y accesorios',
    query: 'audience=mujer',
    icon: UserRound,
  },
  {
    label: 'Hombre',
    description: 'Estilo diario y deportivo',
    query: 'audience=hombre',
    icon: PersonStanding,
  },
  {
    label: 'Niños',
    description: 'Modelos para los más chicos',
    query: 'audience=ninos',
    icon: Baby,
  },
  {
    label: 'Ofertas',
    description: 'Precios especiales por tiempo limitado',
    query: 'ofertas=true',
    icon: BadgePercent,
  },
] as const

const AUDIENCE_ACCENTS: Record<string, { iconBg: string; hoverBorder: string }> = {
  Mujer: {
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-rose-500/25',
    hoverBorder: 'hover:border-rose-400/80 hover:shadow-rose-500/10',
  },
  Hombre: {
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-blue-500/25',
    hoverBorder: 'hover:border-blue-400/80 hover:shadow-blue-500/10',
  },
  Niños: {
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-amber-500/25',
    hoverBorder: 'hover:border-amber-400/80 hover:shadow-amber-500/10',
  },
  Ofertas: {
    iconBg: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 group-hover:bg-red-600 group-hover:text-white group-hover:shadow-red-500/25',
    hoverBorder: 'hover:border-red-400/80 hover:shadow-red-500/10',
  },
}

export function StorefrontAudienceLinks() {
  const style = useStorefrontStyle()
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  if (style === 'classic') return null

  const sport = style === 'sport'

  return (
    <section
      aria-labelledby="storefront-shopping-paths"
      className={cn(
        'border-b py-7 sm:py-9',
        sport ? 'border-slate-800 bg-slate-950 text-white' : 'border-primary/15 bg-gradient-to-b from-primary/[0.04] via-background to-primary/[0.02] dark:border-stone-800 dark:bg-stone-950',
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
          <div>
            <p className={cn('text-[10px] font-bold uppercase tracking-[0.22em]', sport ? 'text-lime-300' : 'text-primary')}>
              Encontrá lo tuyo
            </p>
            <h2
              id="storefront-shopping-paths"
              className={cn('mt-1 text-xl font-extrabold tracking-tight sm:text-2xl', sport && 'uppercase italic')}
            >
              Comprá como te resulte más fácil
            </h2>
          </div>
          <Link
            href={`${tenantPrefix}/productos`}
            className={cn('hidden items-center gap-1 text-xs font-bold sm:inline-flex', sport ? 'text-lime-300' : 'text-primary hover:underline')}
          >
            Ver todo <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <nav aria-label="Comprar por público" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
          {SHOPPING_PATHS.map(({ label, description, query, icon: Icon }) => {
            const accent = AUDIENCE_ACCENTS[label]
            return (
              <Link
                key={label}
                href={`${tenantPrefix}/productos?${query}`}
                className={cn(
                  'group flex min-h-24 items-center gap-3 border p-3.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-28 sm:p-4 rounded-xl',
                  sport
                    ? 'rounded-sm border-slate-700 bg-slate-900 hover:border-lime-300'
                    : cn('border-border/80 bg-card/90 hover:bg-card shadow-2xs hover:shadow-md hover:-translate-y-0.5', accent?.hoverBorder),
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
                    sport ? 'bg-lime-300 text-slate-950' : (accent?.iconBg || 'bg-primary/10 text-primary')
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className={cn('flex items-center gap-1 text-sm font-extrabold sm:text-base', sport && 'uppercase italic')}>
                    {label}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                  <span className={cn('mt-1 hidden text-xs leading-snug sm:block', sport ? 'text-slate-400' : 'text-muted-foreground')}>
                    {description}
                  </span>
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </section>
  )
}
