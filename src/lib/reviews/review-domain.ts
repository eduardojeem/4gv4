export const REVIEW_STATUSES = ['pending', 'published', 'rejected', 'hidden', 'reported'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const REVIEW_VERIFICATION_TYPES = ['open', 'purchase', 'repair'] as const
export type ReviewVerificationType = (typeof REVIEW_VERIFICATION_TYPES)[number]

type LegacyReviewState = {
  moderation_status?: string | null
  is_approved: boolean
  is_visible: boolean
}

export type ReviewStatsInput = {
  rating: number
  status: ReviewStatus
  verification_type: ReviewVerificationType
  business_response?: string | null
}

export type ReviewStats = {
  average: number
  count: number
  total: number
  pending: number
  published: number
  hidden: number
  rejected: number
  reported: number
  verifiedAverage: number
  verifiedCount: number
  respondedCount: number
  satisfactionRate: number
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>
}

export function getReviewStatus(review: LegacyReviewState): ReviewStatus {
  if (REVIEW_STATUSES.includes(review.moderation_status as ReviewStatus)) {
    return review.moderation_status as ReviewStatus
  }
  if (!review.is_approved) return 'pending'
  return review.is_visible ? 'published' : 'hidden'
}

export function getVerificationLabel(type: ReviewVerificationType): string {
  if (type === 'purchase') return 'Compra verificada'
  if (type === 'repair') return 'Reparación verificada'
  return 'Opinión abierta'
}

export function calculateReviewStats(reviews: ReviewStatsInput[]): ReviewStats {
  const breakdown: ReviewStats['breakdown'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const statusCounts: Record<ReviewStatus, number> = {
    pending: 0,
    published: 0,
    rejected: 0,
    hidden: 0,
    reported: 0,
  }
  let publishedSum = 0
  let verifiedSum = 0
  let verifiedCount = 0
  let respondedCount = 0

  for (const review of reviews) {
    statusCounts[review.status] += 1
    if (review.status !== 'published') continue

    const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating)))) as 1 | 2 | 3 | 4 | 5
    breakdown[rating] += 1
    publishedSum += rating
    if (review.verification_type !== 'open') {
      verifiedSum += rating
      verifiedCount += 1
    }
    if (review.business_response?.trim()) respondedCount += 1
  }

  const published = statusCounts.published
  const satisfied = breakdown[4] + breakdown[5]
  return {
    average: published > 0 ? Number((publishedSum / published).toFixed(1)) : 0,
    count: published,
    total: reviews.length,
    pending: statusCounts.pending,
    published,
    hidden: statusCounts.hidden,
    rejected: statusCounts.rejected,
    reported: statusCounts.reported,
    verifiedAverage: verifiedCount > 0 ? Number((verifiedSum / verifiedCount).toFixed(1)) : 0,
    verifiedCount,
    respondedCount,
    satisfactionRate: published > 0 ? Math.round((satisfied / published) * 100) : 0,
    breakdown,
  }
}
