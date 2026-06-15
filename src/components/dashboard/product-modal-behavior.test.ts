import { describe, expect, it } from 'vitest'
import { getFirstProductErrorTab, shouldConfirmProductModalClose } from './product-modal-behavior'

describe('getFirstProductErrorTab', () => {
  it('opens the first section that contains a validation error after submit', () => {
    expect(getFirstProductErrorTab(['sale_price', 'stock_quantity'])).toBe('pricing')
    expect(getFirstProductErrorTab(['exchange_window_days'])).toBe('post-sale')
  })

  it('does not force navigation when no known field has an error', () => {
    expect(getFirstProductErrorTab([])).toBeNull()
  })
})

describe('shouldConfirmProductModalClose', () => {
  it('blocks closing while a product is being saved', () => {
    expect(shouldConfirmProductModalClose({ isDirty: false, isSubmitting: true })).toBe('blocked')
  })

  it('blocks closing while product images are being uploaded', () => {
    expect(shouldConfirmProductModalClose({
      isDirty: false,
      isSubmitting: false,
      isUploadingImages: true,
    })).toBe('blocked')
  })

  it('asks for confirmation when the form has unsaved changes', () => {
    expect(shouldConfirmProductModalClose({ isDirty: true, isSubmitting: false })).toBe('confirm')
  })

  it('closes directly when there are no unsaved changes', () => {
    expect(shouldConfirmProductModalClose({ isDirty: false, isSubmitting: false })).toBe('close')
  })
})
