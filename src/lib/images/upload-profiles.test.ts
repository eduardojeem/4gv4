import { describe, expect, it } from 'vitest'

import {
  IMAGE_UPLOAD_PROFILES,
  PUBLIC_IMAGE_CACHE_CONTROL,
  replaceImageExtension,
} from './upload-profiles'

describe('image upload profiles', () => {
  it('defines the public image budgets', () => {
    expect(IMAGE_UPLOAD_PROFILES.product).toMatchObject({
      maxDimension: 1280,
      targetBytes: 200 * 1024,
      outputMime: 'image/webp',
      extension: 'webp',
    })
    expect(IMAGE_UPLOAD_PROFILES.banner).toMatchObject({
      maxDimension: 1920,
      targetBytes: 400 * 1024,
      outputMime: 'image/webp',
      extension: 'webp',
    })
    expect(IMAGE_UPLOAD_PROFILES.logo).toMatchObject({
      maxDimension: 512,
      targetBytes: 100 * 1024,
      outputMime: 'image/webp',
      extension: 'webp',
    })
  })

  it('uses a one-year immutable cache duration', () => {
    expect(PUBLIC_IMAGE_CACHE_CONTROL).toBe('31536000')
  })

  it.each([
    ['photo.jpg', 'photo.webp'],
    ['photo.PNG', 'photo.webp'],
    ['photo', 'photo.webp'],
    ['photo.jpg.exe', 'photo.webp'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(replaceImageExtension(input, 'webp')).toBe(expected)
  })
})
