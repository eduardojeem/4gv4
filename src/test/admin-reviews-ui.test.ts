import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = [
  'src/components/admin/reviews/reviews-management.tsx',
  'src/components/admin/reviews/ReviewActionDialog.tsx',
  'src/components/admin/reviews/ReviewsHelpDialog.tsx',
  'src/components/admin/reviews/ReviewRequestDialog.tsx',
].map((path) => readFileSync(resolve(process.cwd(), path), 'utf8')).join('\n')

describe('admin reviews reputation UI', () => {
  it('uses the canonical public tenant review URL', () => {
    expect(source).toContain('/${stats.storeSlug}/inicio#resenas')
    expect(source).not.toContain('/store/${stats.storeSlug}#reviews')
  })

  it('supports verification filters, public replies and reasoned moderation', () => {
    expect(source).toContain('verification')
    expect(source).toContain('business_response')
    expect(source).toContain('moderation_reason')
    expect(source).toContain('Compra verificada')
    expect(source).toContain('Reparación verificada')
  })

  it('asks for honest feedback and has no permanent delete workflow', () => {
    expect(source).toContain('opinión honesta')
    expect(source).not.toContain('opiniones positivas')
    expect(source).not.toContain("method: 'DELETE'")
  })

  it('offers contextual help with workflow and examples', () => {
    expect(source).toContain('<ReviewsHelpDialog />')
    expect(source).toContain('Flujo recomendado')
    expect(source).toContain('Moderá el contenido, no la calificación')
    expect(source).toContain('Respondé con contexto y una solución')
  })
})
