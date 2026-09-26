import type { ReviewVerificationType } from '@/lib/reviews/review-domain'

export interface PublicReview {
  id: string
  reviewer_name: string
  rating: number
  comment: string | null
  created_at: string
  verification_type: ReviewVerificationType
  business_response: string | null
  responded_at: string | null
}

export interface PublicReviewStats {
  average: number
  count: number
  verifiedAverage: number
  verifiedCount: number
  respondedCount: number
  satisfactionRate: number
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface ReviewsResponse {
  success: boolean
  error?: string
  data?: {
    reviews: PublicReview[]
    stats: PublicReviewStats
    pagination: { total: number; limit: number; offset: number }
  }
}

export type PublicReviewFilter = 'all' | 'verified' | 'purchase' | 'repair'
