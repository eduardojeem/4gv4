import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { adminNavItems } from '@/config/admin-navigation'

describe('admin finance home entry', () => {
  it('offers Finanzas as a direct administration dashboard entry', () => {
    const finances = adminNavItems.find((item) => item.href === '/admin/finances')

    expect(finances).toBeDefined()
    expect(finances?.label).toBe('Finanzas')
    expect(finances?.icon.displayName ?? finances?.icon.name).toContain('WalletCards')
  })

  // El panel solía repetir a mano la lista de secciones, y quedaba desfasada del
  // menú lateral. Derivarla de la configuración es lo que garantiza la entrada a
  // Finanzas, así que se protege esa derivación en vez del texto de la tarjeta.
  it('builds the dashboard sections from the shared navigation config', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/admin/page.tsx'), 'utf8')

    expect(source).toContain('adminNavCategories')
    expect(source).toContain('filterCategoriesByPermissions')
  })
})
