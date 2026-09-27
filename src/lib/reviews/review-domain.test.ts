import { describe, expect, it } from 'vitest'
import { calculateReviewStats, getReviewStatus, getVerificationLabel } from './review-domain'

describe('review domain', () => {
  it('keeps rejected reviews separate from pending reviews', () => {
    expect(getReviewStatus({ moderation_status: 'rejected', is_approved: false, is_visible: false }))
      .toBe('rejected')
    expect(getReviewStatus({ moderation_status: null, is_approved: false, is_visible: true }))
      .toBe('pending')
  })

  it('uses only published reviews for public breakdown and satisfaction', () => {
    const stats = calculateReviewStats([
      { rating: 5, status: 'published', verification_type: 'purchase', business_response: 'Gracias' },
      { rating: 4, status: 'published', verification_type: 'open', business_response: null },
      { rating: 1, status: 'pending', verification_type: 'open', business_response: null },
      { rating: 2, status: 'hidden', verification_type: 'repair', business_response: null },
      { rating: 3, status: 'rejected', verification_type: 'open', business_response: null },
    ])

    expect(stats.average).toBe(4.5)
    expect(stats.count).toBe(2)
    expect(stats.breakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 })
    expect(stats.satisfactionRate).toBe(100)
    expect(stats.pending).toBe(1)
    expect(stats.hidden).toBe(1)
    expect(stats.rejected).toBe(1)
  })

  it('reports verified metrics separately without changing the general average', () => {
    const stats = calculateReviewStats([
      { rating: 5, status: 'published', verification_type: 'purchase', business_response: null },
      { rating: 1, status: 'published', verification_type: 'open', business_response: null },
      { rating: 4, status: 'published', verification_type: 'repair', business_response: 'Gracias' },
    ])

    expect(stats.average).toBe(3.3)
    expect(stats.verifiedAverage).toBe(4.5)
    expect(stats.verifiedCount).toBe(2)
    expect(stats.respondedCount).toBe(1)
  })

  it('uses honest verification labels', () => {
    expect(getVerificationLabel('purchase')).toBe('Compra verificada')
    expect(getVerificationLabel('repair')).toBe('Reparación verificada')
    expect(getVerificationLabel('open')).toBe('Opinión abierta')
  })
})
