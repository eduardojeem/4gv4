import { describe, expect, it } from 'vitest'
import { median, percentile } from '@/lib/health/statistics'

describe('median', () => {
  it('returns null without finite samples', () => {
    expect(median([])).toBeNull()
    expect(median([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull()
  })

  it('handles single, odd and even sample counts', () => {
    expect(median([120])).toBe(120)
    expect(median([30, 10, 20])).toBe(20)
    expect(median([40, 10, 30, 20])).toBe(25)
  })

  it('does not mutate its input', () => {
    const samples = [30, 10, 20]
    median(samples)
    expect(samples).toEqual([30, 10, 20])
  })
})

describe('percentile', () => {
  it('uses nearest rank and handles repeated values', () => {
    expect(percentile([10, 20, 30, 40, 50], 95)).toBe(50)
    expect(percentile([10, 10, 10], 95)).toBe(10)
  })

  it('clamps percentiles and ignores non-finite samples', () => {
    expect(percentile([Number.NaN, 20, 10], -1)).toBe(10)
    expect(percentile([20, 10, Number.POSITIVE_INFINITY], 101)).toBe(20)
    expect(percentile([], 95)).toBeNull()
  })

  it('does not mutate its input', () => {
    const samples = [30, 10, 20]
    percentile(samples, 95)
    expect(samples).toEqual([30, 10, 20])
  })
})
