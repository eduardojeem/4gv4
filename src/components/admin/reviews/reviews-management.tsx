'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, ChevronLeft, ChevronRight, Download, Eye, MessageSquareReply, RefreshCw, Search, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { getVerificationLabel, type ReviewStatus } from '@/lib/reviews/review-domain'
import { ReviewStars } from '@/components/public/inicio/ReviewStars'
import { ReviewActionDialog } from './ReviewActionDialog'
import { ReviewsHelpDialog } from './ReviewsHelpDialog'
import { ReviewRequestDialog } from './ReviewRequestDialog'
import type { AdminReview, AdminReviewFilter, AdminReviewStats, AdminVerificationFilter } from './review-admin-types'

const PAGE_SIZE = 12
const EMPTY_STATS: AdminReviewStats = {
  average: 0, count: 0, total: 0, pending: 0, approved: 0, published: 0,
  rejected: 0, hidden: 0, reported: 0, verifiedAverage: 0, verifiedCount: 0,
  respondedCount: 0, satisfactionRate: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  storeSlug: null, storeName: 'Mi Tienda',
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pendiente', published: 'Publicada', rejected: 'Rechazada', hidden: 'Oculta', reported: 'Reportada',
}
const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  published: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  hidden: 'bg-muted text-muted-foreground',
  reported: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

function downloadCurrentPage(reviews: AdminReview[], slug: string | null) {
  if (reviews.length === 0) return false
  const headers = ['Cliente', 'Email', 'Calificacion', 'Estado', 'Verificacion', 'Comentario', 'Respuesta', 'Fecha']
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = reviews.map((review) => [
    review.reviewer_name, review.reviewer_email, review.rating, STATUS_LABEL[review.moderation_status],
    getVerificationLabel(review.verification_type), review.comment, review.business_response, review.created_at,
  ].map(escape).join(','))
  const blob = new Blob([`\uFEFF${headers.join(',')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `opiniones_${slug || 'organizacion'}_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  return true
}

export function ReviewsManagement() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [filter, setFilter] = useState<AdminReviewFilter>('pending')
  const [verification, setVerification] = useState<AdminVerificationFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const params = new URLSearchParams({
      status: filter,
      verification,
      search,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
      sort: 'newest',
    })
    try {
      const response = await fetch(`/api/admin/reviews?${params}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudieron cargar las opiniones.')
      setReviews(data.data.reviews ?? [])
      setStats(data.data.stats ?? EMPTY_STATS)
      setTotal(data.data.pagination?.total ?? 0)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar las opiniones.'
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [filter, page, search, verification])

  useEffect(() => { void fetchReviews() }, [fetchReviews])

  const publicStoreUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return stats.storeSlug
      ? `${window.location.origin}/${stats.storeSlug}/inicio#resenas`
      : `${window.location.origin}/inicio#resenas`
  }, [stats.storeSlug])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const responseRate = stats.published > 0 ? Math.round((stats.respondedCount / stats.published) * 100) : 0

  function changeStatus(value: string) {
    setFilter(value as AdminReviewFilter)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-none"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Promedio público</p><p className="mt-2 text-3xl font-bold">{stats.average.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">/ 5</span></p><p className="mt-1 text-xs text-muted-foreground">{stats.published} publicadas</p></CardContent></Card>
        <Card className="shadow-none"><CardContent className="p-4"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><BadgeCheck className="h-4 w-4 text-emerald-600" />Experiencias verificadas</p><p className="mt-2 text-3xl font-bold">{stats.verifiedCount}</p><p className="mt-1 text-xs text-muted-foreground">Promedio {stats.verifiedAverage.toFixed(1)}</p></CardContent></Card>
        <Card className="shadow-none"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Requieren revisión</p><p className="mt-2 text-3xl font-bold">{stats.pending + stats.reported}</p><p className="mt-1 text-xs text-muted-foreground">{stats.pending} pendientes · {stats.reported} reportadas</p></CardContent></Card>
        <Card className="shadow-none"><CardContent className="p-4"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><MessageSquareReply className="h-4 w-4 text-primary" />Tasa de respuesta</p><p className="mt-2 text-3xl font-bold">{responseRate}%</p><p className="mt-1 text-xs text-muted-foreground">{stats.respondedCount} respuestas públicas</p></CardContent></Card>
      </div>

      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" placeholder="Buscar cliente, email o comentario" aria-label="Buscar opiniones" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={verification} onValueChange={(value: AdminVerificationFilter) => { setVerification(value); setPage(1) }}>
                <SelectTrigger className="w-48" aria-label="Filtrar por verificación"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda procedencia</SelectItem>
                  <SelectItem value="verified">Sólo verificadas</SelectItem>
                  <SelectItem value="purchase">Compra verificada</SelectItem>
                  <SelectItem value="repair">Reparación verificada</SelectItem>
                  <SelectItem value="open">Opinión abierta</SelectItem>
                </SelectContent>
              </Select>
              <ReviewsHelpDialog />
              <Button variant="outline" onClick={() => { if (downloadCurrentPage(reviews, stats.storeSlug)) toast.success('Página exportada') }}><Download className="h-4 w-4" />Exportar página</Button>
              <Button onClick={() => setRequestDialogOpen(true)}><Send className="h-4 w-4" />Solicitar opinión</Button>
            </div>
          </div>

          <Tabs value={filter} onValueChange={changeStatus}>
            <TabsList className="h-auto w-full justify-start overflow-x-auto bg-transparent p-0">
              <TabsTrigger value="pending">Pendientes ({stats.pending})</TabsTrigger>
              <TabsTrigger value="published">Publicadas ({stats.published})</TabsTrigger>
              <TabsTrigger value="reported">Reportadas ({stats.reported})</TabsTrigger>
              <TabsTrigger value="hidden">Ocultas ({stats.hidden})</TabsTrigger>
              <TabsTrigger value="rejected">Rechazadas ({stats.rejected})</TabsTrigger>
              <TabsTrigger value="all">Todas ({stats.total})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Cargando opiniones">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-44 animate-pulse rounded-lg border bg-card" />)}
        </div>
      ) : loadError ? (
        <Card className="border-destructive/30 shadow-none"><CardContent className="p-8 text-center"><p className="text-sm text-destructive">{loadError}</p><Button variant="outline" className="mt-3" onClick={() => void fetchReviews()}><RefreshCw className="h-4 w-4" />Reintentar</Button></CardContent></Card>
      ) : reviews.length === 0 ? (
        <Card className="border-dashed shadow-none"><CardContent className="p-10 text-center"><Eye className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No hay opiniones en este filtro</p><p className="mt-1 text-sm text-muted-foreground">Cambiá el estado, la procedencia o la búsqueda.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {reviews.map((review) => (
            <Card key={review.id} className="shadow-none">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold">{review.reviewer_name}</p><p className="truncate text-xs text-muted-foreground">{review.reviewer_email || 'Sin email'} · {new Date(review.created_at).toLocaleDateString('es-PY')}</p></div>
                  <ReviewStars value={review.rating} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={cn(STATUS_STYLE[review.moderation_status])}>{STATUS_LABEL[review.moderation_status]}</Badge>
                  <Badge variant="outline" className={cn('gap-1', review.verification_type !== 'open' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700')}><BadgeCheck className="h-3.5 w-3.5" />{getVerificationLabel(review.verification_type)}</Badge>
                  {review.business_response && <Badge variant="secondary"><MessageSquareReply className="mr-1 h-3.5 w-3.5" />Respondida</Badge>}
                </div>
                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{review.comment || 'Sin comentario escrito.'}</p>
                {review.moderation_reason && <p className="rounded bg-muted px-2.5 py-2 text-xs text-muted-foreground"><strong>Motivo interno:</strong> {review.moderation_reason}</p>}
                <Button variant="outline" size="sm" className="mt-auto w-fit" onClick={() => setSelectedReview(review)}>Revisar y responder</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">Mostrando {reviews.length} de {total}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" />Anterior</Button>
            <span className="text-xs">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <ReviewActionDialog review={selectedReview} onOpenChange={(open) => { if (!open) setSelectedReview(null) }} onSaved={() => void fetchReviews()} />
      <ReviewRequestDialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen} publicUrl={publicStoreUrl} storeName={stats.storeName} />
    </div>
  )
}
