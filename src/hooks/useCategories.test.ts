import { describe, it, expect } from 'vitest'
import { validateCategoryInput } from './useCategories'

describe('validateCategoryInput', () => {
  it('should fail when name is empty', () => {
    const res = validateCategoryInput({ name: '', description: 'Descripción válida' })
    expect(res.valid).toBe(false)
    expect(res.errors.name).toBeTruthy()
  })

  it('should fail when description is too short', () => {
    const res = validateCategoryInput({ name: 'Accesorios', description: 'corta' })
    expect(res.valid).toBe(false)
    expect(res.errors.description).toBeTruthy()
  })

  it('should pass with valid data', () => {
    const res = validateCategoryInput({ name: 'Accesorios', description: 'Elementos y complementos para dispositivos' })
    expect(res.valid).toBe(true)
    expect(Object.keys(res.errors).length).toBe(0)
  })
})

