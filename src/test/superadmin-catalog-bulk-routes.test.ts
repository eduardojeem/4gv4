import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('rutas masivas de catálogos', () => {
  it('delegan categorías, marcas y vínculos manuales a las RPC', () => {
    expect(read('src/app/api/superadmin/global-categories/route.ts')).toContain("rpc('apply_global_category_links'")
    expect(read('src/app/api/superadmin/global-brands/route.ts')).toContain("rpc('apply_global_brand_links'")
    const manual = read('src/lib/catalog/manual-link.ts')
    expect(manual).toContain('apply_global_category_links')
    expect(manual).toContain('apply_global_brand_links')
  })

  it('no informa éxito si la RPC devuelve fallos', () => {
    const actions = read('src/lib/catalog/manual-link-actions.ts')
    expect(actions).toContain('bulkResultSucceeded')
    expect(actions).toContain('success: false')
  })

  it('protege el análisis y aplica las sugerencias en un único lote atómico', () => {
    const route = read('src/app/api/superadmin/global-categories/route.ts')
    const panel = read('src/components/superadmin/CategorySyncAssistantPanel.tsx')

    expect(route).toContain("rateLimiter.check(`superadmin:category-analysis:${user.id}`")
    expect(route).toContain("body?.action === 'link-analyzed-batch'")
    expect(route).toContain("rpc('apply_global_category_links'")
    expect(panel).toContain("action: 'link-analyzed-batch'")
    expect(panel).not.toMatch(/for \(const item of highConfidenceItems\)[\s\S]*fetch\(/)
  })

  it('invalida sugerencias cuando se recarga la fuente del catálogo', () => {
    const manager = read('src/components/superadmin/GlobalCategoriesManager.tsx')
    const panel = read('src/components/superadmin/CategorySyncAssistantPanel.tsx')

    expect(manager).toContain('sourceVersion={assistantSourceVersion}')
    expect(panel).toContain('}, [sourceVersion])')
    expect(panel).toContain('setResults(null)')
  })
})
