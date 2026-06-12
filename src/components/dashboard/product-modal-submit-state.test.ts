import { describe, expect, it } from 'vitest'
import { getProductSubmitState } from './product-modal-submit-state'

describe('getProductSubmitState', () => {
  it('does not present creation as ready while required fields are invalid', () => {
    expect(getProductSubmitState({
      isEditing: false,
      isSubmitting: false,
      isValid: false,
    })).toMatchObject({
      label: 'Revisar datos obligatorios',
      ready: false,
    })
  })

  it('presents the final creation action only when the form is valid', () => {
    expect(getProductSubmitState({
      isEditing: false,
      isSubmitting: false,
      isValid: true,
    })).toMatchObject({
      label: 'Crear Producto',
      ready: true,
    })
  })
})
