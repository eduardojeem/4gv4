'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BadgePercent, Building2, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

export type MarketplaceOfferGroup = {
  organizationId: string
  organizationName: string
  organizationSlug: string
  products: MarketplaceProduct[]
}

type Props = {
  groups: MarketplaceOfferGroup[]
}

export function MarketplaceOffersSection({ groups }: Props) {
  const availableGroups = useMemo(() => groups.filter((group) => group.products.length > 0), [groups])
  const [activeSlug, setActiveSlug] = useState(availableGroups[0]?.organizationSlug ?? '')
  const activeGroup = availableGroups.find((group) => group.organizationSlug === activeSlug) ?? availableGroups[0]

  if (!activeGroup) return null

  const totalOffers = availableGroups.reduce((total, group) => total + group.products.length, 0)

  return (
    <section className="border-y border-rose-100 bg-rose-50/60 py-12 dark:border-rose-900/20 dark:bg-rose-950/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold uppercase text-white shadow-sm">
              <Flame className="h-3.5 w-3.5" />
              Ofertas destacadas
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Promociones por empresa
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Productos con descuento publicados por cada organizacion. Cambia de empresa para ver su vitrina de ofertas.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
            <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 dark:border-rose-900/40 dark:bg-slate-950">
              <div className="text-xs text-slate-500">Empresas</div>
              <div className="font-bold text-slate-900 dark:text-slate-50">{availableGroups.length}</div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 dark:border-rose-900/40 dark:bg-slate-950">
              <div className="text-xs text-slate-500">Ofertas</div>
              <div className="font-bold text-rose-600 dark:text-rose-400">{totalOffers}</div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide" aria-label="Empresas con ofertas">
          {availableGroups.map((group) => {
            const active = group.organizationSlug === activeGroup.organizationSlug

            return (
              <button
                key={group.organizationId}
                type="button"
                onClick={() => setActiveSlug(group.organizationSlug)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'border-rose-500 bg-rose-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                )}
              >
                <Building2 className="h-4 w-4" />
                <span>{group.organizationName}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px]', active ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300')}>
                  {group.products.length}
                </span>
              </button>
            )
          })}
        </div>

        <div className="rounded-lg border border-rose-200 bg-white p-4 shadow-sm dark:border-rose-900/40 dark:bg-slate-950">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-600 text-white">
                <BadgePercent className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-50">{activeGroup.organizationName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeGroup.products.length} oferta{activeGroup.products.length !== 1 ? 's' : ''} activa{activeGroup.products.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <Button asChild variant="outline" size="sm" className="w-fit gap-2">
              <Link href={`/${activeGroup.organizationSlug}/productos`}>
                Ver tienda
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <MarketplaceProductCarousel products={activeGroup.products} variant="offers" />
        </div>
      </div>
    </section>
  )
}
