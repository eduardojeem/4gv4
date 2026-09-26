'use client'

import { FormEvent, useState } from 'react'
import { AlertCircle, CheckCircle2, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'
import { withOrgQuery } from '@/lib/saas/tenant'
import { ReviewStarsInput } from './ReviewStars'

export function OrganizationReviewForm({
  tenantSlug,
  inviteToken,
  hasRepairs = false,
  onSuccess,
}: {
  tenantSlug: string | null
  inviteToken: string | null
  hasRepairs?: boolean
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setStatus('idle')
    try {
      const response = await fetch(withOrgQuery('/api/public/reviews', tenantSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_name: name,
          reviewer_email: email || null,
          rating,
          comment: comment || null,
          captcha_token: captchaToken,
          invite_token: inviteToken,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo enviar la reseña.')

      setName('')
      setEmail('')
      setRating(0)
      setComment('')
      setCaptchaToken(null)
      setCaptchaResetKey((value) => value + 1)
      setStatus('success')
      onSuccess()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error de conexión. Intenta nuevamente.')
      setStatus('error')
      setCaptchaToken(null)
      setCaptchaResetKey((value) => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-center" role="status">
        <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
        <p className="mt-2 font-semibold">Gracias por compartir tu experiencia</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu opinión quedó pendiente de revisión. Te avisaremos cuando sea publicada.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {inviteToken && (
        <div className="flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {hasRepairs
            ? 'Este enlace permitirá comprobar tu compra o reparación sin mostrar sus datos.'
            : 'Este enlace permitirá comprobar tu compra sin mostrar sus datos.'}
        </div>
      )}

      <div>
        <span className="mb-2 block text-sm font-medium">Tu calificación *</span>
        <ReviewStarsInput value={rating} onChange={setRating} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="review-name" className="mb-1 block text-sm font-medium">Nombre *</label>
          <Input id="review-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="review-email" className="mb-1 block text-sm font-medium">Email <span className="text-muted-foreground">(opcional)</span></label>
          <Input id="review-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </div>
      </div>

      <div>
        <label htmlFor="review-comment" className="mb-1 block text-sm font-medium">Comentario <span className="text-muted-foreground">(opcional)</span></label>
        <Textarea id="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={4} placeholder="Contanos cómo fue tu experiencia." />
        <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length}/500</p>
      </div>

      {captchaRequired && (
        <TurnstileChallenge action="submit_review" onTokenChange={setCaptchaToken} resetKey={captchaResetKey} disabled={submitting} />
      )}

      {status === 'error' && (
        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <p className="text-xs leading-5 text-muted-foreground">
        El negocio puede responder o moderar contenido que incumpla las reglas, pero no puede editar tu puntuación ni comentario.
      </p>
      <Button type="submit" disabled={submitting || !name.trim() || rating === 0 || (captchaRequired && !captchaToken)}>
        <Send className="h-4 w-4" aria-hidden="true" />
        {submitting ? 'Enviando…' : 'Enviar reseña'}
      </Button>
    </form>
  )
}
