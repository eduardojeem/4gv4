import { BadgeCheck, MessageSquareReply, ShoppingBag, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getVerificationLabel } from '@/lib/reviews/review-domain'
import { ReviewStars } from './ReviewStars'
import type { PublicReview } from './review-types'

const verificationIcon = {
  open: BadgeCheck,
  purchase: ShoppingBag,
  repair: Wrench,
}

export function OrganizationReviewCard({ review }: { review: PublicReview }) {
  const VerificationIcon = verificationIcon[review.verification_type]
  const verified = review.verification_type !== 'open'
  const formattedDate = new Date(review.created_at).toLocaleDateString('es-PY', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <Card className="h-full border-border/70 shadow-none">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{review.reviewer_name}</p>
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
          </div>
          <ReviewStars value={review.rating} />
        </div>

        <Badge
          variant="outline"
          className={verified
            ? 'w-fit gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'w-fit gap-1 text-muted-foreground'}
        >
          <VerificationIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {getVerificationLabel(review.verification_type)}
        </Badge>

        {review.comment && <p className="text-sm leading-6 text-muted-foreground">{review.comment}</p>}

        {review.business_response && (
          <div className="mt-auto rounded-lg border-l-2 border-primary bg-muted/45 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <MessageSquareReply className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Respuesta del negocio
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{review.business_response}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
