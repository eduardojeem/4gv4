'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Star, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'

interface ReviewData {
  id: string
  reviewer_name: string
  rating: number
  comment: string | null
  created_at: string
}

interface ReviewsResponse {
  success: boolean
  data: {
    reviews: ReviewData[]
    stats: { average: number; count: number }
    pagination: { total: number; limit: number; offset: number }
  }
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: {
  value: number
  onChange?: (rating: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const [hovered, setHovered] = useState(0)
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'

  return (
    <div className="flex gap-0.5" role="group" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            'transition-transform',
            !readonly && 'cursor-pointer hover:scale-110',
            readonly && 'cursor-default'
          )}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          onClick={() => onChange?.(star)}
          aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              sizeClass,
              'transition-colors',
              (hovered || value) >= star
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-slate-300'
            )}
          />
        </button>
      ))}
    </div>
  )
}

function ReviewForm({ onSuccess, tenantSlug }: { onSuccess: () => void; tenantSlug: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      setStatus('error')
      setErrorMsg('Selecciona una calificación')
      return
    }

    setSubmitting(true)
    setStatus('idle')

    try {
      const res = await fetch(withOrgQuery('/api/public/reviews', tenantSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_name: name,
          reviewer_email: email || null,
          rating,
          comment: comment || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(data.error || 'Error al enviar la reseña')
        return
      }

      setStatus('success')
      setName('')
      setEmail('')
      setRating(0)
      setComment('')
      onSuccess()
    } catch {
      setStatus('error')
      setErrorMsg('Error de conexión. Intenta nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }, [name, email, rating, comment, onSuccess, tenantSlug])

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950/30">
        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        <p className="font-medium text-green-800 dark:text-green-300">
          ¡Gracias por tu reseña!
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">
          Tu opinión ya está publicada y visible para todos.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStatus('idle')}
          className="mt-2"
        >
          Escribir otra reseña
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Tu calificación *</label>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="review-name" className="mb-1 block text-sm font-medium">
            Nombre *
          </label>
          <Input
            id="review-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            required
            minLength={2}
            maxLength={100}
          />
        </div>
        <div>
          <label htmlFor="review-email" className="mb-1 block text-sm font-medium">
            Email <span className="text-muted-foreground">(opcional)</span>
          </label>
          <Input
            id="review-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="review-comment" className="mb-1 block text-sm font-medium">
          Comentario <span className="text-muted-foreground">(opcional)</span>
        </label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Cuéntanos tu experiencia con este negocio..."
          maxLength={500}
          rows={3}
        />
        {comment.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{comment.length}/500</p>
        )}
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <Button type="submit" disabled={submitting || !name.trim() || rating === 0}>
        <Send className="mr-2 h-4 w-4" />
        {submitting ? 'Enviando...' : 'Enviar reseña'}
      </Button>
    </form>
  )
}

function ReviewCard({ review }: { review: ReviewData }) {
  const date = new Date(review.created_at)
  const formattedDate = date.toLocaleDateString('es', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{review.reviewer_name}</p>
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
          </div>
          <StarRating value={review.rating} readonly size="sm" />
        </div>
        {review.comment && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {review.comment}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RatingSummary({ average, count }: { average: number; count: number }) {
  if (count === 0) return null

  return (
    <div className="flex items-center gap-3">
      <span className="text-4xl font-bold">{average.toFixed(1)}</span>
      <div>
        <StarRating value={Math.round(average)} readonly size="md" />
        <p className="mt-0.5 text-sm text-muted-foreground">
          {count} reseña{count !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

export function OrganizationReviews() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const { data, mutate } = useSWR<ReviewsResponse>(
    withOrgQuery('/api/public/reviews?limit=6', tenantSlug),
    fetcher,
    { revalidateOnFocus: false }
  )

  const [showAll, setShowAll] = useState(false)
  const hydratedData = mounted ? data : undefined
  const reviews = hydratedData?.data?.reviews ?? []
  const stats = hydratedData?.data?.stats ?? { average: 0, count: 0 }
  const total = hydratedData?.data?.pagination?.total ?? 0

  const displayedReviews = showAll ? reviews : reviews.slice(0, 3)

  return (
    <section id="resenas" className="border-t bg-muted/40 py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-4xl">
          {/* Encabezado */}
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Opiniones de nuestros clientes
            </h2>
            <p className="mt-2 text-muted-foreground">
              Conoce la experiencia de quienes nos visitaron
            </p>
          </div>

          {/* Resumen de rating */}
          {stats.count > 0 && (
            <div className="mb-8 flex justify-center">
              <RatingSummary average={stats.average} count={stats.count} />
            </div>
          )}

          {/* Grid de reseñas existentes */}
          {displayedReviews.length > 0 && (
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}

          {/* Botón "ver más" */}
          {!showAll && total > 3 && (
            <div className="mb-10 text-center">
              <Button variant="outline" onClick={() => setShowAll(true)}>
                Ver todas las reseñas ({total})
              </Button>
            </div>
          )}

          {/* Formulario para dejar reseña */}
          <div className="mx-auto max-w-lg rounded-2xl border bg-background p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-center">
              ¿Ya nos visitaste? Dejanos tu opinión
            </h3>
            <ReviewForm onSuccess={() => mutate()} tenantSlug={tenantSlug} />
          </div>
        </div>
      </div>
    </section>
  )
}
