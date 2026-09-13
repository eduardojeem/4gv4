'use client'

import { useState, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { BadgeCheck, ChevronLeft, ChevronRight, MessageSquareText, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import { OrganizationReviewCard } from './OrganizationReviewCard'
import { OrganizationReviewForm } from './OrganizationReviewForm'
import { ReviewStars } from './ReviewStars'
import type { PublicReviewFilter, PublicReviewStats, ReviewsResponse } from './review-types'

const PAGE_SIZE = 6
const EMPTY_STATS: PublicReviewStats = {
  average: 0,
  count: 0,
  verifiedAverage: 0,
  verifiedCount: 0,
  respondedCount: 0,
  satisfactionRate: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}
const FILTERS: Array<{ value: PublicReviewFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'verified', label: 'Verificadas' },
  { value: 'purchase', label: 'Compras' },
  { value: 'repair', label: 'Reparaciones' },
]

const subscribeToNothing = () => () => {}

const fetcher = async (url: string): Promise<ReviewsResponse> => {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'No se pudieron cargar las reseñas.')
  return data
}

function ReviewsSummary({ stats }: { stats: PublicReviewStats }) {
  if (stats.count === 0) return null
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="flex items-center gap-4 sm:block sm:min-w-40 sm:text-center">
          <p className="text-4xl font-bold tracking-tight">{stats.average.toFixed(1)}</p>
          <div>
            <ReviewStars value={stats.average} size="md" />
            <p className="mt-1 text-sm text-muted-foreground">{stats.count} opiniones públicas</p>
          </div>
        </div>
        <div className="space-y-2" aria-label="Distribución de calificaciones">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = stats.breakdown[rating as 1 | 2 | 3 | 4 | 5] ?? 0
            return (
              <div key={rating} className="grid grid-cols-[18px_1fr_28px] items-center gap-2 text-xs">
                <span>{rating}</span>
                <Progress value={stats.count > 0 ? (count / stats.count) * 100 : 0} className="h-1.5" />
                <span className="text-right text-muted-foreground">{count}</span>
              </div>
            )
          })}
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" />{stats.verifiedCount} verificadas</span>
          <span>{stats.verifiedCount > 0 ? `${stats.verifiedAverage.toFixed(1)} promedio verificado` : 'Aún sin opiniones verificadas'}</span>
          <span>{stats.respondedCount} respondidas por el negocio</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function OrganizationReviews() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const inviteToken = searchParams.get('review')
  const [filter, setFilter] = useState<PublicReviewFilter>('all')
  const [page, setPage] = useState(1)
  const offset = (page - 1) * PAGE_SIZE
  const url = withOrgQuery(
    `/api/public/reviews?limit=${PAGE_SIZE}&offset=${offset}&verification=${filter}`,
    tenantSlug,
  )
  const { data, error, isLoading, mutate } = useSWR<ReviewsResponse>(url, fetcher, { revalidateOnFocus: false })
  const hydratedData = mounted ? data : undefined
  const reviews = hydratedData?.data?.reviews ?? []
  const stats = hydratedData?.data?.stats ?? EMPTY_STATS
  const total = hydratedData?.data?.pagination.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function selectFilter(nextFilter: PublicReviewFilter) {
    setFilter(nextFilter)
    setPage(1)
  }

  return (
    <section id="resenas" className="border-t bg-muted/35 py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4">
        <header className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Experiencias reales de clientes</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Distinguimos las opiniones abiertas de las compras y reparaciones comprobadas por el sistema.
          </p>
        </header>

        <div className="mt-8"><ReviewsSummary stats={stats} /></div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filtrar opiniones">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? 'default' : 'outline'}
              aria-pressed={filter === item.value}
              onClick={() => selectFilter(item.value)}
              className="shrink-0"
            >
              {item.value === 'verified' && <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
              {item.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 min-h-48" aria-live="polite">
           {!mounted || isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Cargando opiniones">
              {[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-xl border bg-card" />)}
            </div>
           ) : error || hydratedData?.success === false ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="text-sm text-destructive">No pudimos cargar las opiniones.</p>
              <Button variant="outline" size="sm" onClick={() => void mutate()} className="mt-3">
                <RefreshCw className="h-4 w-4" /> Reintentar
              </Button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-background p-8 text-center">
              <p className="font-medium">No hay opiniones en este filtro</p>
              <p className="mt-1 text-sm text-muted-foreground">Probá otro filtro o compartí la primera experiencia.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => <OrganizationReviewCard key={review.id} review={review} />)}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Páginas de opiniones">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        )}

        <div className={cn('mx-auto mt-10 max-w-2xl rounded-xl border bg-background p-5 sm:p-6', inviteToken && 'border-emerald-500/40')}>
          <h3 className="text-lg font-semibold">{inviteToken ? 'Contanos tu experiencia verificada' : '¿Ya nos visitaste? Dejanos tu opinión'}</h3>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Las opiniones se revisan por contenido, no por la cantidad de estrellas.</p>
          <OrganizationReviewForm tenantSlug={tenantSlug} inviteToken={inviteToken} onSuccess={() => void mutate()} />
        </div>
      </div>
    </section>
  )
}
