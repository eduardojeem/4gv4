import { describe, expect, it } from 'vitest'
import { canTransitionCatalogStatus, catalogStatusSchema } from './editorial-status'

describe('flujo editorial del catálogo', () => {
  it.each([
    ['candidate', 'review'], ['review', 'published'], ['published', 'inactive'], ['inactive', 'review'],
  ] as const)('permite %s → %s', (from, to) => expect(canTransitionCatalogStatus(from, to)).toBe(true))

  it('no permite publicar un candidato sin revisión', () => {
    expect(canTransitionCatalogStatus('candidate', 'published')).toBe(false)
    expect(catalogStatusSchema.safeParse('inventado').success).toBe(false)
  })
})
