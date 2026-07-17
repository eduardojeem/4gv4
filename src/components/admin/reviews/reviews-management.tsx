'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Star,
  Check,
  X,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  RefreshCw,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Review {
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

interface ReviewsStats {
  average: number
  count: number
}

type FilterStatus = 'all' | 'pending' | 'approved'

export function ReviewsManagement() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewsStats>({ average: 0, count: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const res = await fetch(
        `/api/admin/reviews?status=${filter}&limit=${pageSize}&offset=${offset}`
      )
      const data = await res.json()
      if (data.success) {
        setReviews(data.data.reviews)
        setStats(data.data.stats)
        setTotal(data.data.pagination.total)
      }
    } catch {
      toast.error('Error al cargar reseñas')
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: true }),
      })
      if (res.ok) {
        toast.success('Reseña aprobada')
        fetchReviews()
      } else {
        toast.error('Error al aprobar')
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
        toast.success(currentlyVisible ? 'Reseña ocultada' : 'Reseña visible')
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
    if (!confirm('¿Eliminar esta reseña permanentemente?')) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Reseña eliminada')
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pendingCount = reviews.filter((r) => !r.is_approved).length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-yellow-100 p-2.5 dark:bg-yellow-900/30">
              <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.average.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Promedio general</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.count}</p>
              <p className="text-xs text-muted-foreground">Reseñas publicadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-orange-100 p-2.5 dark:bg-orange-900/30">
              <Loader2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total ({filter === 'pending' ? 'pendientes' : filter})</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v as FilterStatus); setPage(1) }}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              Pendientes
              {pendingCount > 0 && (
                <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Aprobadas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button variant="outline" size="sm" onClick={fetchReviews} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[200px] font-semibold text-xs uppercase">Autor</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs uppercase">Rating</TableHead>
                <TableHead className="font-semibold text-xs uppercase">Comentario</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs uppercase">Estado</TableHead>
                <TableHead className="w-[120px] font-semibold text-xs uppercase">Fecha</TableHead>
                <TableHead className="w-[160px] text-right font-semibold text-xs uppercase">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : reviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No hay reseñas {filter === 'pending' ? 'pendientes' : ''} por mostrar.
                  </TableCell>
                </TableRow>
              ) : (
                reviews.map((review) => (
                  <TableRow key={review.id} className="group">
                    <TableCell className="py-3">
                      <p className="font-medium text-sm">{review.reviewer_name}</p>
                      {review.reviewer_email && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {review.reviewer_email}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={cn(
                              'h-3.5 w-3.5',
                              s <= review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-slate-200'
                            )}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground line-clamp-2 max-w-[300px]">
                        {review.comment || <span className="italic">Sin comentario</span>}
                      </p>
                    </TableCell>
                    <TableCell>
                      {review.is_approved ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300"
                        >
                          {review.is_visible ? 'Publicada' : 'Oculta'}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300"
                        >
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString('es', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!review.is_approved && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleApprove(review.id)}
                            disabled={actionLoading === review.id}
                            title="Aprobar"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {!review.is_approved && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            onClick={() => handleReject(review.id)}
                            disabled={actionLoading === review.id}
                            title="Rechazar"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        {review.is_approved && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleVisibility(review.id, review.is_visible)}
                            disabled={actionLoading === review.id}
                            title={review.is_visible ? 'Ocultar' : 'Mostrar'}
                          >
                            {review.is_visible ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(review.id)}
                          disabled={actionLoading === review.id}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {total} reseña{total !== 1 ? 's' : ''} en total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
