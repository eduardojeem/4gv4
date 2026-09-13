'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Star,
  Check,
  CheckCheck,
  X,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  RefreshCw,
  MessageSquare,
  MessageSquareHeart,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  Table as TableIcon,
  Share2,
  Copy,
  Download,
  Quote,
  ThumbsUp,
  Mail,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface Review {
  id: string
  reviewer_name: string
  reviewer_email: string | null
  rating: number
  comment: string | null
  is_approved: boolean
  is_visible: boolean
  created_at: string
  updated_at: string
}

export interface ReviewsStats {
  average: number
  count: number
  total: number
  pending: number
  approved: number
  hidden: number
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>
  satisfactionRate: number
  storeSlug: string | null
  storeName: string
}

type FilterStatus = 'pending' | 'approved' | 'hidden' | 'all'
type SortOption = 'newest' | 'oldest' | 'rating_desc' | 'rating_asc'
type ViewMode = 'table' | 'cards'

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Más recientes',
  oldest: 'Más antiguas',
  rating_desc: 'Mayor puntuación (5 a 1)',
  rating_asc: 'Menor puntuación (1 a 5)',
}

export function ReviewsManagement() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewsStats>({
    average: 0,
    count: 0,
    total: 0,
    pending: 0,
    approved: 0,
    hidden: 0,
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    satisfactionRate: 100,
    storeSlug: null,
    storeName: 'Mi Tienda',
  })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Filters & State
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const pageSize = 18

  // Selection & Modals
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)
  const [bulkApprovePendingOpen, setBulkApprovePendingOpen] = useState(false)
  const [reviewDetail, setReviewDetail] = useState<Review | null>(null)
  const [requestReviewsOpen, setRequestReviewsOpen] = useState(false)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(handler)
  }, [searchInput])

  // Clear selections on filter/page change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filter, ratingFilter, searchQuery, sort, page])

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const params = new URLSearchParams({
        status: filter,
        limit: String(pageSize),
        offset: String(offset),
        sort,
      })

      if (searchQuery) {
        params.set('search', searchQuery)
      }
      if (ratingFilter) {
        params.set('rating', String(ratingFilter))
      }

      const res = await fetch(`/api/admin/reviews?${params.toString()}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setReviews(data.data.reviews)
        setStats(data.data.stats)
        setTotal(data.data.pagination.total)
      } else {
        toast.error(data?.error || 'Error al cargar reseñas')
      }
    } catch {
      toast.error('Error de conexión al cargar reseñas')
    } finally {
      setLoading(false)
    }
  }, [filter, ratingFilter, searchQuery, sort, page, pageSize])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  // Single Item Handlers
  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: true, is_visible: true }),
      })
      if (res.ok) {
        toast.success('Reseña aprobada y publicada')
        fetchReviews()
      } else {
        toast.error('Error al aprobar reseña')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: false, is_visible: false }),
      })
      if (res.ok) {
        toast.success('Reseña rechazada')
        fetchReviews()
      } else {
        toast.error('Error al rechazar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleVisibility = async (id: string, currentlyVisible: boolean) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_visible: !currentlyVisible }),
      })
      if (res.ok) {
        toast.success(currentlyVisible ? 'Reseña ocultada de la tienda' : 'Reseña visible en la tienda')
        fetchReviews()
      } else {
        toast.error('Error al cambiar visibilidad')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReviewToDelete(null)
        toast.success('Reseña eliminada permanentemente')
        fetchReviews()
      } else {
        toast.error('Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setActionLoading(null)
    }
  }

  // Bulk Handlers
  const handleBulkAction = async (action: 'approve' | 'reject' | 'show' | 'hide' | 'delete') => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedIds)
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Operación en lote completada')
        setSelectedIds(new Set())
        setBulkDeleteConfirmOpen(false)
        fetchReviews()
      } else {
        toast.error(data.error || 'Error al ejecutar acción en lote')
      }
    } catch {
      toast.error('Error de conexión al procesar lote')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleApproveAllPending = async () => {
    setBulkLoading(true)
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_all_pending' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('¡Todas las reseñas pendientes fueron aprobadas!')
        setBulkApprovePendingOpen(false)
        fetchReviews()
      } else {
        toast.error(data.error || 'Error al aprobar reseñas')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setBulkLoading(false)
    }
  }

  // Selection toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === reviews.length && reviews.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(reviews.map((r) => r.id)))
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    if (reviews.length === 0) {
      toast.error('No hay reseñas para exportar en este filtro')
      return
    }

    const headers = ['ID', 'Cliente', 'Email', 'Calificación', 'Comentario', 'Aprobada', 'Visible', 'Fecha']
    const rows = reviews.map((r) => [
      `"${r.id}"`,
      `"${(r.reviewer_name || '').replace(/"/g, '""')}"`,
      `"${(r.reviewer_email || '').replace(/"/g, '""')}"`,
      r.rating,
      `"${(r.comment || '').replace(/"/g, '""')}"`,
      r.is_approved ? 'Sí' : 'No',
      r.is_visible ? 'Sí' : 'No',
      `"${new Date(r.created_at).toLocaleString('es')}"`,
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `resenas_${stats.storeSlug || 'tienda'}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Archivo CSV descargado correctamente')
  }

  // Public review URL generator
  const publicStoreUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const origin = window.location.origin
    if (stats.storeSlug) {
      return `${origin}/store/${stats.storeSlug}#reviews`
    }
    return `${origin}/#reviews`
  }, [stats.storeSlug])

  const copyPublicLink = async () => {
    if (!publicStoreUrl) return
    try {
      await navigator.clipboard.writeText(publicStoreUrl)
      toast.success('Enlace de reseñas copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const shareViaWhatsApp = () => {
    if (!publicStoreUrl) return
    const text = `¡Hola! Gracias por elegir ${stats.storeName}. Nos encantaría conocer tu opinión para seguir brindándote la mejor experiencia. Podés dejarnos tu reseña en este enlace rápido:\n${publicStoreUrl}\n\n¡Muchas gracias!`
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank')
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const allSelected = reviews.length > 0 && selectedIds.size === reviews.length

  return (
    <div className="space-y-6">
      {/* 1. Panel de Métricas de Reputación */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Calificación Promedio */}
        <Card className="relative overflow-hidden border-border/70 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Calificación General
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Star className="h-4 w-4 fill-amber-500" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {stats.average > 0 ? stats.average.toFixed(1) : '0.0'}
              </span>
              <span className="text-sm font-medium text-muted-foreground">/ 5.0</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-4 w-4',
                    star <= Math.round(stats.average)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground/30'
                  )}
                />
              ))}
              <span className="ml-1 text-xs text-muted-foreground">
                ({stats.count} pública{stats.count !== 1 ? 's' : ''})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Nivel de Satisfacción */}
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Satisfacción Clientes
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ThumbsUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {stats.total > 0 ? `${stats.satisfactionRate}%` : '100%'}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Opiniones de 4 y 5 estrellas recibidas en tu tienda.
            </p>
          </CardContent>
        </Card>

        {/* Desglose por Estrellas (Clickable Filters) */}
        <Card className="border-border/70 shadow-xs sm:col-span-2">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Desglose por Estrellas
              </span>
              {ratingFilter !== null && (
                <button
                  type="button"
                  onClick={() => setRatingFilter(null)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver todas las estrellas
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((stars) => {
                const count = stats.breakdown[stars] || 0
                const percent = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                const isSelected = ratingFilter === stars

                return (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => setRatingFilter(isSelected ? null : stars)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors',
                      isSelected ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted/50'
                    )}
                    title={`Filtrar por ${stars} estrellas`}
                  >
                    <div className="flex w-12 items-center gap-1 shrink-0 text-xs font-medium">
                      <span>{stars}</span>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </div>
                    <Progress value={percent} className="h-2 flex-1" />
                    <span className="w-12 text-right text-xs font-medium text-muted-foreground">
                      {count} <span className="text-[10px]">({percent}%)</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Barra de Herramientas y Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Pestañas de Estado */}
          <Tabs
            value={filter}
            onValueChange={(val) => {
              setFilter(val as FilterStatus)
              setPage(1)
            }}
            className="w-full lg:w-auto"
          >
            <TabsList className="grid grid-cols-4 w-full sm:w-auto">
              <TabsTrigger value="pending" className="gap-1.5 px-3 text-xs">
                Pendientes
                {stats.pending > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
                    {stats.pending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1.5 px-3 text-xs">
                Aprobadas
                <span className="text-[11px] text-muted-foreground">({stats.approved})</span>
              </TabsTrigger>
              <TabsTrigger value="hidden" className="gap-1.5 px-3 text-xs">
                Ocultas
                <span className="text-[11px] text-muted-foreground">({stats.hidden})</span>
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5 px-3 text-xs">
                Todas
                <span className="text-[11px] text-muted-foreground">({stats.total})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Acciones principales derechas */}
          <div className="flex flex-wrap items-center gap-2">
            {stats.pending > 0 && filter === 'pending' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={() => setBulkApprovePendingOpen(true)}
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Aprobar todas las pendientes</span>
                <span className="sm:hidden">Aprobar todas</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setRequestReviewsOpen(true)}
            >
              <Share2 className="h-3.5 w-3.5 text-primary" />
              Pedir Reseñas
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={exportToCSV}
              title="Descargar listado actual en formato CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={fetchReviews}
              disabled={loading}
              title="Actualizar reseñas"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>

            {/* Alternador de vista (Tabla vs Tarjetas) */}
            <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-muted/40">
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7 rounded-md', viewMode === 'cards' && 'bg-background shadow-xs text-foreground')}
                onClick={() => setViewMode('cards')}
                title="Vista en tarjetas (Muro de testimonios)"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7 rounded-md', viewMode === 'table' && 'bg-background shadow-xs text-foreground')}
                onClick={() => setViewMode('table')}
                title="Vista compacta en tabla"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Buscador, Filtro de Estrellas y Ordenamiento */}
        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por cliente, email o palabras clave..."
              className="pl-9 pr-8 text-xs h-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* Filtro por calificación */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs shrink-0">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {ratingFilter ? `${ratingFilter} estrellas` : 'Todas las estrellas'}
                  <SlidersHorizontal className="h-3 w-3 text-muted-foreground ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setRatingFilter(null)}>
                  Todas las estrellas
                </DropdownMenuItem>
                {[5, 4, 3, 2, 1].map((stars) => (
                  <DropdownMenuItem
                    key={stars}
                    onClick={() => setRatingFilter(stars)}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1">
                      {stars} <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    </span>
                    <span className="text-xs text-muted-foreground">({stats.breakdown[stars as 1 | 2 | 3 | 4 | 5] || 0})</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Orden */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs shrink-0">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Orden:</span> {SORT_LABELS[sort]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <DropdownMenuItem key={opt} onClick={() => setSort(opt)}>
                    {SORT_LABELS[opt]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* 3. Barra flotante de Acciones en Lote */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary text-white font-bold px-1.5 text-xs">
              {selectedIds.size}
            </span>
            <span>reseña{selectedIds.size > 1 ? 's' : ''} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-xs"
              onClick={() => handleBulkAction('approve')}
              disabled={bulkLoading}
            >
              <Check className="h-3.5 w-3.5" />
              Aprobar
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => handleBulkAction('hide')}
              disabled={bulkLoading}
            >
              <EyeOff className="h-3.5 w-3.5" />
              Ocultar
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => handleBulkAction('show')}
              disabled={bulkLoading}
            >
              <Eye className="h-3.5 w-3.5" />
              Hacer visible
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs"
              onClick={() => setBulkDeleteConfirmOpen(true)}
              disabled={bulkLoading}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* 4. Contenido de Reseñas: Vista Tarjetas o Vista Tabla */}
      {loading ? (
        <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed bg-muted/20">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Cargando reseñas...</span>
          </div>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No se encontraron reseñas</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {searchQuery || ratingFilter
              ? 'Probá ajustando la búsqueda o los filtros seleccionados.'
              : filter === 'pending'
                ? '¡Genial! No tenés reseñas pendientes de moderar.'
                : 'Aún no hay reseñas registradas en esta categoría.'}
          </p>
          <div className="mt-4 flex gap-2">
            {(searchQuery || ratingFilter) && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setSearchInput('')
                  setSearchQuery('')
                  setRatingFilter(null)
                }}
              >
                Limpiar filtros
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setRequestReviewsOpen(true)}
            >
              <Share2 className="h-3.5 w-3.5" />
              Pedir opiniones a clientes
            </Button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* Vista Tarjetas (Muro de testimonios) */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                id="select-all-cards"
              />
              <label htmlFor="select-all-cards" className="cursor-pointer font-medium">
                Seleccionar todas ({reviews.length})
              </label>
            </div>
            <span>
              Mostrando {reviews.length} de {total}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => {
              const isSelected = selectedIds.has(review.id)
              const initials = review.reviewer_name
                ? review.reviewer_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : 'U'

              return (
                <Card
                  key={review.id}
                  className={cn(
                    'group relative flex flex-col justify-between overflow-hidden border-border/70 bg-card transition-all duration-200 hover:shadow-md hover:border-primary/40',
                    isSelected && 'border-primary ring-2 ring-primary/30 bg-primary/[0.02]'
                  )}
                >
                  <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold text-xs shadow-xs ring-1 ring-primary/20">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate max-w-[150px]">
                              {review.reviewer_name}
                            </p>
                            {review.reviewer_email ? (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[150px] flex items-center gap-1">
                                <Mail className="h-2.5 w-2.5 shrink-0" />
                                {review.reviewer_email}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground/60 italic">Sin correo</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(review.id)}
                            aria-label={`Seleccionar reseña de ${review.reviewer_name}`}
                          />
                        </div>
                      </div>

                      {/* Estrellas y Badge de Estado */}
                      <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                'h-3.5 w-3.5',
                                s <= review.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200 dark:text-slate-800'
                              )}
                            />
                          ))}
                        </div>

                        {review.is_approved ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.2',
                              review.is_visible
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-muted text-muted-foreground border-border'
                            )}
                          >
                            {review.is_visible ? 'Publicada' : 'Oculta'}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold px-2 py-0.2"
                          >
                            Pendiente
                          </Badge>
                        )}
                      </div>

                      {/* Comentario */}
                      <div className="relative rounded-xl bg-muted/30 p-2.5 text-xs leading-relaxed text-foreground/90 italic">
                        <Quote className="h-3 w-3 text-muted-foreground/40 mb-0.5" />
                        {review.comment ? (
                          <p className="line-clamp-4 font-normal not-italic text-xs">{review.comment}</p>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Calificación sin comentario escrito.</span>
                        )}
                      </div>
                    </div>

                    {/* Pie: Fecha y Botones de Acción */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(review.created_at).toLocaleDateString('es', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setReviewDetail(review)}
                          title="Ver detalle completo"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>

                        {!review.is_approved ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                              onClick={() => handleApprove(review.id)}
                              disabled={actionLoading === review.id}
                              title="Aprobar y publicar"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                              onClick={() => handleReject(review.id)}
                              disabled={actionLoading === review.id}
                              title="Rechazar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleVisibility(review.id, review.is_visible)}
                            disabled={actionLoading === review.id}
                            title={review.is_visible ? 'Ocultar de la tienda' : 'Hacer visible'}
                          >
                            {review.is_visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={() => setReviewToDelete(review.id)}
                          disabled={actionLoading === review.id}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        /* Vista Tabla Compacta */
        <Card className="border-border/70 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[40px] px-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todas"
                    />
                  </TableHead>
                  <TableHead className="w-[200px] text-xs font-semibold uppercase tracking-wider">Cliente</TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider">Puntuación</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Comentario</TableHead>
                  <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="w-[140px] text-right text-xs font-semibold uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => {
                  const isSelected = selectedIds.has(review.id)
                  const initials = review.reviewer_name
                    ? review.reviewer_name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'U'

                  return (
                    <TableRow
                      key={review.id}
                      className={cn('group transition-colors', isSelected && 'bg-primary/5')}
                    >
                      <TableCell className="px-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(review.id)}
                          aria-label={`Seleccionar reseña de ${review.reviewer_name}`}
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-foreground truncate max-w-[160px]">
                              {review.reviewer_name}
                            </p>
                            {review.reviewer_email ? (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                                {review.reviewer_email}
                              </p>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 italic">Sin correo</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                'h-3.5 w-3.5',
                                s <= review.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200 dark:text-slate-800'
                              )}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 max-w-[340px]">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {review.comment || <span className="italic text-muted-foreground/60">Sin comentario</span>}
                          </p>
                          {review.comment && review.comment.length > 80 && (
                            <button
                              type="button"
                              onClick={() => setReviewDetail(review)}
                              className="text-[10px] font-semibold text-primary hover:underline shrink-0"
                            >
                              Ver más
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {review.is_approved ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5',
                              review.is_visible
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-muted text-muted-foreground border-border'
                            )}
                          >
                            {review.is_visible ? 'Publicada' : 'Oculta'}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold px-2 py-0.5"
                          >
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(review.created_at).toLocaleDateString('es', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setReviewDetail(review)}
                            title="Ver detalle completo"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>

                          {!review.is_approved ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                onClick={() => handleApprove(review.id)}
                                disabled={actionLoading === review.id}
                                title="Aprobar y publicar"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                                onClick={() => handleReject(review.id)}
                                disabled={actionLoading === review.id}
                                title="Rechazar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleToggleVisibility(review.id, review.is_visible)}
                              disabled={actionLoading === review.id}
                              title={review.is_visible ? 'Ocultar de la tienda' : 'Hacer visible'}
                            >
                              {review.is_visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => setReviewToDelete(review.id)}
                            disabled={actionLoading === review.id}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/70 pt-4 px-1">
          <p className="text-xs text-muted-foreground">
            Mostrando {reviews.length} de {total} reseña{total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Button>
            <span className="text-xs font-medium px-2">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* 5. Modal de Detalle de Reseña */}
      <Dialog open={Boolean(reviewDetail)} onOpenChange={(open) => { if (!open) setReviewDetail(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <MessageSquareHeart className="h-5 w-5 text-amber-500" />
              Detalle de Opinión
            </DialogTitle>
            <DialogDescription className="text-xs">
              Información completa y estado de la valoración del cliente.
            </DialogDescription>
          </DialogHeader>

          {reviewDetail && (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3.5">
                <div>
                  <p className="font-semibold text-sm text-foreground">{reviewDetail.reviewer_name}</p>
                  <p className="text-muted-foreground">{reviewDetail.reviewer_email || 'Sin correo especificado'}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-0.5 justify-end">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'h-4 w-4',
                          s <= reviewDetail.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/30'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-foreground mt-0.5 inline-block">
                    {reviewDetail.rating} de 5 estrellas
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Comentario del cliente:
                </span>
                <div className="mt-1.5 rounded-xl border border-border/70 bg-card p-3.5 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {reviewDetail.comment || <span className="italic text-muted-foreground">El cliente no incluyó comentario de texto.</span>}
                </div>
              </div>

              <div className="flex items-center justify-between text-muted-foreground pt-1">
                <span>Fecha: {new Date(reviewDetail.created_at).toLocaleString('es')}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[11px]',
                    reviewDetail.is_approved
                      ? reviewDetail.is_visible
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground'
                      : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                  )}
                >
                  {reviewDetail.is_approved
                    ? reviewDetail.is_visible ? 'Publicada' : 'Oculta'
                    : 'Pendiente'}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {reviewDetail && (
              <div className="flex w-full items-center justify-between gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const id = reviewDetail.id
                    setReviewDetail(null)
                    setReviewToDelete(id)
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </Button>

                <div className="flex items-center gap-2">
                  {!reviewDetail.is_approved ? (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      onClick={() => {
                        handleApprove(reviewDetail.id)
                        setReviewDetail(null)
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprobar y publicar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        handleToggleVisibility(reviewDetail.id, reviewDetail.is_visible)
                        setReviewDetail(null)
                      }}
                    >
                      {reviewDetail.is_visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {reviewDetail.is_visible ? 'Ocultar' : 'Hacer visible'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Modal «Pedir Reseñas a Clientes» */}
      <Dialog open={requestReviewsOpen} onOpenChange={setRequestReviewsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Share2 className="h-5 w-5 text-primary" />
              Pedir Reseñas a Clientes
            </DialogTitle>
            <DialogDescription className="text-xs">
              Compartí el enlace directo con tus compradores por WhatsApp o redes para conseguir más opiniones positivas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
              <span className="text-xs font-semibold text-foreground">Enlace público de tu tienda:</span>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={publicStoreUrl}
                  className="text-xs font-mono bg-background select-all h-9"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyPublicLink}
                  className="shrink-0 gap-1.5 h-9 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2">
              <span className="text-xs font-semibold text-foreground">Mensaje sugerido para WhatsApp:</span>
              <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg italic leading-relaxed">
                «¡Hola! Gracias por elegir ${stats.storeName}. Tu opinión nos ayuda un montón a seguir mejorando. ¿Nos dejarías tu reseña en este link? ${publicStoreUrl} ¡Muchas gracias!»
              </p>
              <Button
                className="w-full gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium text-xs h-9 shadow-sm"
                onClick={shareViaWhatsApp}
              >
                <MessageSquare className="h-4 w-4 fill-white" />
                Abrir y enviar por WhatsApp
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestReviewsOpen(false)}
              className="text-xs"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Diálogo de confirmación: Aprobar todas las pendientes */}
      <AlertDialog open={bulkApprovePendingOpen} onOpenChange={setBulkApprovePendingOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar todas las reseñas pendientes?</AlertDialogTitle>
            <AlertDialogDescription>
              Se publicarán inmediatamente las {stats.pending} reseña{stats.pending !== 1 ? 's' : ''} pendientes en la página pública de tu tienda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={bulkLoading}
              onClick={(e) => {
                e.preventDefault()
                void handleApproveAllPending()
              }}
            >
              {bulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sí, aprobar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 8. Diálogo de confirmación: Eliminar selección en lote */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedIds.size} reseña(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará de forma permanente las reseñas seleccionadas y no se podrá revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={bulkLoading}
              onClick={(e) => {
                e.preventDefault()
                void handleBulkAction('delete')
              }}
            >
              {bulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sí, eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 9. Diálogo de confirmación: Eliminar una sola reseña */}
      <AlertDialog
        open={Boolean(reviewToDelete)}
        onOpenChange={(open) => {
          if (!open && !actionLoading) setReviewToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar reseña</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción elimina permanentemente la reseña y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(actionLoading)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!reviewToDelete || Boolean(actionLoading)}
              onClick={(event) => {
                event.preventDefault()
                if (reviewToDelete) void handleDelete(reviewToDelete)
              }}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
