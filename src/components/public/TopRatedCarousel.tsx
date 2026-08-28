'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Building2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

type Props = {
  organizations: MarketplaceOrganization[]
}

function OrgLogo({ org }: { org: MarketplaceOrganization }) {
  return (
    <Link
      href={`/${org.slug}/inicio`}
      className="group flex shrink-0 items-center gap-3 rounded-xl border border-transparent px-4 py-3 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm dark:hover:border-slate-800 dark:hover:bg-slate-900"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-white p-1 shadow-xs transition-transform group-hover:scale-105 dark:border-slate-800 dark:bg-slate-900">
        {org.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 font-bold text-xs text-white">
            {org.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {org.name}
        </p>
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={cn(
                  'h-3 w-3',
                  s <= Math.round(Number(org.review_rating_avg ?? 0))
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-slate-200 dark:text-slate-700'
                )}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-slate-500">
            {Number(org.review_rating_avg ?? 0).toFixed(1)}
          </span>
          <span className="text-xs text-slate-400">
            ({org.review_count})
          </span>
        </div>
      </div>
    </Link>
  )
}

function LogoMarquee({ items, direction = 'left' }: { items: MarketplaceOrganization[]; direction?: 'left' | 'right' }) {
  // Duplicar items para loop infinito
  const doubled = [...items, ...items]

  return (
    <div className="relative overflow-hidden">
      {/* Fade en los bordes */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white dark:from-slate-950" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white dark:from-slate-950" />

      <div
        className={cn(
          'flex w-max gap-8 py-4',
          direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right'
        )}
      >
        {doubled.map((org, i) => (
          <OrgLogo key={`${org.id}-${i}`} org={org} />
        ))}
      </div>
    </div>
  )
}

export function TopRatedCarousel({ organizations }: Props) {
  const topRated = organizations
    .filter((org) => (org.review_count ?? 0) > 0)
    .sort((a, b) => {
      const ratingDiff = Number(b.review_rating_avg ?? 0) - Number(a.review_rating_avg ?? 0)
      if (ratingDiff !== 0) return ratingDiff
      return Number(b.review_count ?? 0) - Number(a.review_count ?? 0)
    })
    .slice(0, 16)

  if (topRated.length === 0) return null

  const totalReviews = topRated.reduce((sum, org) => sum + Number(org.review_count ?? 0), 0)
  const avgRating = topRated.reduce((sum, org) => sum + Number(org.review_rating_avg ?? 0), 0) / topRated.length

  // Si hay pocas empresas, mostrar sin marquee (layout estático centrado)
  const useMarquee = topRated.length >= 4

  // Para marquee: dividir en dos filas
  const mid = Math.ceil(topRated.length / 2)
  const row1 = topRated.slice(0, mid)
  const row2 = topRated.slice(mid)

  return (
    <section className="mb-12 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-8 text-center dark:border-slate-800">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
          Empresas verificadas por clientes
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
          Las mejor calificadas del marketplace
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {topRated.length} empresa{topRated.length !== 1 ? 's' : ''} con {totalReviews} reseña{totalReviews !== 1 ? 's' : ''} · Promedio {avgRating.toFixed(1)} ★
        </p>
      </div>

      {/* Contenido */}
      <div className="py-6">
        {useMarquee ? (
          <div className="space-y-0">
            <LogoMarquee items={row1} direction="left" />
            {row2.length > 0 && <LogoMarquee items={row2} direction="right" />}
          </div>
        ) : (
          /* Pocas empresas: mostrar centrado sin duplicar */
          <div className="flex flex-wrap items-center justify-center gap-4 px-6">
            {topRated.map((org) => (
              <OrgLogo key={org.id} org={org} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
