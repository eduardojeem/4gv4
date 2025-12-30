import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const FiltersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
  stockStatus: z.array(z.string()).optional(),
  featured: z.boolean().nullable().optional()
})

describe('Repairs Inventory Filters validation', () => {
  it('valida filtros básicos', () => {
    const result = FiltersSchema.safeParse({ search: 'pantalla', category: 'phones', supplier: 'apple' })
    expect(result.success).toBe(true)
  })

  it('rechaza featured inválido', () => {
    const result = FiltersSchema.safeParse({ featured: 'si' })
    expect(result.success).toBe(false)
  })
})
