import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WebContentHub, type WebContentHubData } from '@/components/superadmin/WebContentHub'

const base: WebContentHubData = {
  landings: {
    total: 5,
    byStatus: { ready: 2, incomplete: 2, hidden: 1, maintenance: 0 },
    byCheck: {} as never,
    heroCustom: 1,
  },
  brand: { platformName: 'MiTiendaPy', hasLogo: true, hasFavicon: true, isDefaultName: false, hasSeoDescription: true },
  announcements: { total: 2, live: 0, scheduled: 0 },
  legal: [
    { type: 'privacy', publishedVersion: 1, hasDraft: false, responsibleGaps: ['razón social', 'RUC'] },
    { type: 'terms', publishedVersion: 1, hasDraft: false, responsibleGaps: [] },
  ],
  marketplace: { visibleStores: 3, totalStores: 8, products: 1200 },
}

describe('resumen de contenido web', () => {
  it('lista lo pendiente con un enlace a la sección que lo resuelve', () => {
    render(<WebContentHub data={base} />)
    const pending = screen.getByRole('region', { name: /para revisar/i })
    const legal = within(pending).getByRole('link', { name: /política de privacidad: el texto publicado no identifica al responsable/i })
    expect(legal).toHaveAttribute('href', '/superadmin/web-content/legal')
    const landings = within(pending).getByRole('link', { name: /2 tiendas publicadas no tienen lo imprescindible/i })
    expect(landings.getAttribute('href')).toContain('/superadmin/web-content/landing')
  })

  it('cuenta las tiendas con los mismos estados que Landings', () => {
    render(<WebContentHub data={base} />)
    const card = screen.getByRole('link', { name: /landings de tiendas/i })
    expect(within(card).getByText('Listas').previousSibling).toHaveTextContent('2')
    expect(within(card).getByText('Incompletas').previousSibling).toHaveTextContent('2')
  })

  it('sin pendientes no muestra el cuadro de revisión', () => {
    render(<WebContentHub data={{
      ...base,
      landings: { ...base.landings!, byStatus: { ready: 4, incomplete: 0, hidden: 1, maintenance: 0 } },
      legal: base.legal!.map((document) => ({ ...document, responsibleGaps: [] })),
    }} />)
    expect(screen.queryByRole('region', { name: /para revisar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^marketplace tiendas y productos/i })).toHaveTextContent('3 de 8 tiendas visibles')
  })
})
