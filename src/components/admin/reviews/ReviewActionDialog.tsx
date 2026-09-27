'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, Eye, EyeOff, Loader2, MessageSquareReply, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { getVerificationLabel, type ReviewStatus } from '@/lib/reviews/review-domain'
import { ReviewStars } from '@/components/public/inicio/ReviewStars'
import type { AdminReview } from './review-admin-types'

type ModerationAction = Extract<ReviewStatus, 'hidden' | 'rejected'>

export function ReviewActionDialog({
  review,
  onOpenChange,
  onSaved,
}: {
  review: AdminReview | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [response, setResponse] = useState('')
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null)
  const [moderationReason, setModerationReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setResponse(review?.business_response ?? '')
    setModerationAction(null)
    setModerationReason('')
  }, [review])

  async function updateReview(payload: Record<string, string | null>) {
    if (!review) return
    setSaving(true)
    try {
      const result = await fetch(`/api/admin/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.error || 'No se pudo actualizar la opinión.')
      toast.success('Opinión actualizada')
      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la opinión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(review)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Revisar experiencia</DialogTitle>
          <DialogDescription>El comentario y la puntuación del cliente nunca se pueden editar.</DialogDescription>
        </DialogHeader>

        {review && (
          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{review.reviewer_name}</p>
                  <p className="text-xs text-muted-foreground">{review.reviewer_email || 'Sin email informado'}</p>
                </div>
                <ReviewStars value={review.rating} />
              </div>
              <Badge variant="outline" className="mt-3 gap-1"><BadgeCheck className="h-3.5 w-3.5" />{getVerificationLabel(review.verification_type)}</Badge>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{review.comment || 'Sin comentario escrito.'}</p>
            </div>

            <div>
              <label htmlFor="business-response" className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <MessageSquareReply className="h-4 w-4 text-primary" /> Respuesta pública del negocio
              </label>
              <Textarea id="business-response" value={response} onChange={(event) => setResponse(event.target.value)} maxLength={1000} rows={4} placeholder="Agradecé, aclarale una duda o explicá cómo resolviste el problema." />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{response.length}/1000</p>
                <Button size="sm" disabled={saving || response.trim().length < 2} onClick={() => void updateReview({ business_response: response.trim() })}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar respuesta
                </Button>
              </div>
            </div>

            {moderationAction ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <label htmlFor="moderation-reason" className="text-sm font-medium">Motivo obligatorio</label>
                <Textarea id="moderation-reason" className="mt-2" value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} maxLength={500} rows={3} placeholder="Ej.: contiene datos personales o lenguaje ofensivo." />
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setModerationAction(null)}>Cancelar</Button>
                  <Button variant="destructive" size="sm" disabled={saving || moderationReason.trim().length < 3} onClick={() => void updateReview({ moderation_status: moderationAction, moderation_reason: moderationReason.trim() })}>
                    Confirmar {moderationAction === 'hidden' ? 'ocultamiento' : 'rechazo'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {review.moderation_status !== 'published' && (
                  <Button size="sm" onClick={() => void updateReview({ moderation_status: 'published' })} disabled={saving}>
                    <Eye className="h-4 w-4" /> Publicar
                  </Button>
                )}
                {review.moderation_status === 'published' && (
                  <Button variant="outline" size="sm" onClick={() => setModerationAction('hidden')} disabled={saving}>
                    <EyeOff className="h-4 w-4" /> Ocultar con motivo
                  </Button>
                )}
                {review.moderation_status === 'pending' && (
                  <Button variant="outline" size="sm" onClick={() => setModerationAction('rejected')} disabled={saving}>
                    <XCircle className="h-4 w-4" /> Rechazar con motivo
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
