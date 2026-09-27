import type { ReviewStatus, ReviewVerificationType } from '@/lib/reviews/review-domain'

export interface AdminReview {
  id: string
  reviewer_name: string
  reviewer_email: string | null
  rating: number
  comment: string | null
  moderation_status: ReviewStatus
  verification_type: ReviewVerificationType
  business_response: string | null
  responded_at: string | null
  moderation_reason: string | null
  moderated_at: string | null
  sale_id: string | null
  repair_id: string | null
  created_at: string
  updated_at: string
}

export interface AdminReviewStats {
  average: number
  count: number
  total: number
  pending: number
  approved: number
  published: number
  rejected: number
  hidden: number
  reported: number
  verifiedAverage: number
  verifiedCount: number
  respondedCount: number
  satisfactionRate: number
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>
  storeSlug: string | null
  storeName: string
}

export type AdminReviewFilter = ReviewStatus | 'all'
export type AdminVerificationFilter = ReviewVerificationType | 'verified' | 'all'
