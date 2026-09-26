import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(
  resolve(process.cwd(), 'src/app/marketplace/empresas/[slug]/page.tsx'),
  'utf8'
)

describe('volver al marketplace en la página pública de una organización', () => {
  it('ofrece una acción visible y de ancho completo en móvil', () => {
    expect(PAGE).toContain('md:hidden')
    expect(PAGE).toContain('w-full')
    expect(PAGE.match(/Volver al Marketplace/g)).toHaveLength(2)
  })

  it('mantiene la acción lateral únicamente en escritorio', () => {
    expect(PAGE).toContain('hidden md:inline-flex')
  })
})
