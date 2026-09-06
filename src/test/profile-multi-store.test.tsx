import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileActivity } from '@/components/profile/profile-activity'
import { ProfileOrders, type ProfileOrder } from '@/components/profile/profile-orders'
import { ProfileAccountSummary } from '@/components/profile/profile-account-summary'
import {
  customerOrderTrackHref,
  customerRepairHref,
  customerRepairsListHref,
  storeScopedPrefix,
} from '@/lib/public/store-scoped-href'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * El perfil del marketplace junta reparaciones y pedidos de todas las tiendas
 * donde el cliente tiene ficha, pero las pantallas de destino resuelven al
 * cliente contra UNA organizacion: `if (user && organization)` en
 * `api/public/repairs/[ticketId]`, `resolvePublicOrganization` en
 * `api/public/orders/track`. Sin tienda en la ruta, el detalle no autorizaba y
 * el seguimiento buscaba el pedido en la organizacion por defecto.
 */
describe('los enlaces llevan la tienda del registro, no la de la ruta', () => {
  it('sin tienda cae en el prefijo de la ruta, como antes', () => {
    expect(storeScopedPrefix(null, '')).toBe('')
    expect(storeScopedPrefix(undefined, '/tienda-a')).toBe('/tienda-a')
    expect(customerRepairsListHref(null, '')).toBe('/mis-reparaciones')
    expect(customerRepairsListHref(null, '/tienda-a')).toBe('/tienda-a/mis-reparaciones')
  })

  it('con tienda manda, aunque la ruta no tenga ninguna', () => {
    expect(customerRepairHref('tienda-b', '', 'TCK-1')).toBe('/tienda-b/mis-reparaciones/TCK-1')
    expect(customerOrderTrackHref('tienda-b', '', 'ORD-1')).toBe('/tienda-b/track?orderNumber=ORD-1')
  })

  it('un slug vacio no genera doble barra', () => {
    // `''` y `'   '` llegan desde datos sin normalizar; `/​/mis-reparaciones`
    // seria una ruta distinta y rota.
    expect(customerRepairHref('', '', 'TCK-1')).toBe('/mis-reparaciones/TCK-1')
    expect(customerRepairHref('   ', '/tienda-a', 'TCK-1')).toBe('/tienda-a/mis-reparaciones/TCK-1')
  })

  it('escapa lo que va en la URL', () => {
    expect(customerRepairHref('t', '', 'R 2026/1')).toBe('/t/mis-reparaciones/R%202026%2F1')
    expect(customerOrderTrackHref('t', '', 'ORD 1&x')).toBe('/t/track?orderNumber=ORD%201%26x')
  })

  it('el seguimiento sin numero queda en el buscador', () => {
    expect(customerOrderTrackHref(null, '')).toBe('/track')
  })
})

describe('las filas del perfil apuntan a la tienda de cada registro', () => {
  it('la reparacion de otro taller no queda sin prefijo', () => {
    render(
      <ProfileActivity
        tenantPrefix=""
        repairs={[
          {
            id: 'rep-1',
            ticket_number: 'TCK-9901',
            brand: 'Apple',
            model: 'iPhone 13',
            status: 'reparacion',
            created_at: '2026-09-02T14:30:00Z',
            organization: { id: 'org-2', name: 'Electro Express', slug: 'electro-express' },
          },
        ]}
      />
    )

    const enlaces = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => Boolean(href?.includes('mis-reparaciones')))

    expect(enlaces.length).toBeGreaterThan(0)
    for (const href of enlaces) {
      // El "ver todo el historial" es el unico sin ticket: ese sí junta tiendas.
      if (href.endsWith('/mis-reparaciones')) continue
      expect(href).toBe('/electro-express/mis-reparaciones/TCK-9901')
    }
  })

  it('el pedido de otra tienda se rastrea en la suya', () => {
    const pedido: ProfileOrder = {
      id: 'ord-1',
      order_number: 'ORD-2026-001',
      status: 'PENDING',
      payment_status: 'PAID',
      fulfillment_type: 'PICKUP',
      customer_address: null,
      estimated_delivery_date: null,
      total: 150000,
      created_at: '2026-09-01T10:00:00Z',
      organization: { id: 'org-1', name: 'TechStore', slug: 'techstore-central' },
    }

    render(<ProfileOrders orders={[pedido]} tenantPrefix="" />)

    const enlaces = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => Boolean(href?.includes('orderNumber=')))

    expect(enlaces.length).toBeGreaterThan(0)
    for (const href of enlaces) {
      expect(href).toBe('/techstore-central/track?orderNumber=ORD-2026-001')
    }
  })

  it('dentro de una tienda el resultado es el mismo prefijo de siempre', () => {
    render(
      <ProfileActivity
        tenantPrefix="/tienda-a"
        repairs={[
          {
            id: 'rep-2',
            ticket_number: 'TCK-2',
            brand: 'Samsung',
            model: 'A54',
            status: 'listo',
            created_at: '2026-09-02T14:30:00Z',
            organization: { id: 'org-a', name: 'Tienda A', slug: 'tienda-a' },
          },
        ]}
      />
    )

    expect(
      screen.getAllByRole('link').some((link) =>
        link.getAttribute('href') === '/tienda-a/mis-reparaciones/TCK-2'
      )
    ).toBe(true)
  })
})

/**
 * `/mis-reparaciones` resolvia la ficha del cliente con `limit(1)` y sin `order
 * by`: de varias tiendas tomaba una al azar y el resto del historial no existia
 * para el cliente, mientras el perfil —que usa `.in(...)` con todas— seguia
 * contandolas. Los dos numeros no cerraban.
 */
describe('el historial completo abarca todas las tiendas', () => {
  const PAGINA = leer('src/app/(public)/mis-reparaciones/page.tsx')

  it('ya no toma una ficha al azar', () => {
    expect(PAGINA).not.toContain('customerQuery = customerQuery.limit(1)')
    expect(PAGINA).toContain('const customerIds = customerRecords.map((row) => row.id)')
  })

  it('las dos consultas de reparaciones usan todas las fichas', () => {
    // La financiera alimenta los contadores y la otra la lista: si una sola
    // quedara con `.eq(...)`, los totales volverian a no cerrar con las tarjetas.
    expect(PAGINA.match(/\.in\('customer_id', customerIds\)/g)).toHaveLength(2)
    expect(PAGINA).not.toContain(".eq('customer_id', customer.id)")
  })

  it('dentro de una tienda sigue filtrando por esa organizacion', () => {
    expect(PAGINA).toContain("financialRepairsQuery = financialRepairsQuery.eq('organization_id', organization.id)")
    expect(PAGINA).toContain("if (organization) repairsQuery = repairsQuery.eq('organization_id', organization.id)")
  })

  it('cada tarjeta dice de que taller es y enlaza al suyo', () => {
    expect(PAGINA).toContain('const showStorePerRepair = !organization && repairStoreIds.length > 1')
    expect(PAGINA).toContain('customerRepairHref(store?.slug, tenantPrefix, repair.ticket_number || repair.id)')
  })

  it('el encabezado no le atribuye todo a una sola tienda', () => {
    // `companyName` sale de `fetchWebsiteSettings()`, que fuera de una tienda
    // devuelve la de por defecto: decia "tus equipos en <tienda ajena>".
    expect(PAGINA).toContain('talleres donde dejaste equipos.')
    expect(PAGINA).not.toContain('el historial de tus equipos en {companyName}.')
  })
})

/**
 * En el perfil convivian dos saldos a favor: el del resumen, que suma
 * `customer_store_credits` de todas las organizaciones, y el widget
 * `PublicStoreCredit`, que consulta una sola —la de la ruta, o la de por
 * defecto—. Dos numeros distintos para lo mismo, y el sumado tampoco es plata
 * usable: el saldo de una tienda no se gasta en otra.
 */
describe('el saldo a favor se muestra por tienda', () => {
  const RESUMEN = {
    equipment: { total: 4, active: 1, ready: 1, delivered: 2 },
    repairs: { pendingCount: 0, paidCount: 2, pendingAmount: 0 },
    orders: { pendingCount: 0, paidCount: 3, pendingAmount: 0 },
    financing: { pendingAmount: 0, overdueAmount: 0, overdueCount: 0 },
    storeCredit: 80_000,
    totalDue: 0,
    netBalance: 80_000,
  }

  it('con una sola tienda no cambia nada', () => {
    render(
      <ProfileAccountSummary
        summary={RESUMEN}
        storeCredits={[{ organization: { id: 'a', name: 'Tienda A', slug: 'tienda-a' }, amount: 80_000 }]}
      />
    )

    expect(screen.getByText('Saldo disponible a favor')).toBeInTheDocument()
    expect(screen.queryByText(/no se puede usar en otra/i)).not.toBeInTheDocument()
  })

  it('con varias, aclara que no es un total usable y las lista', () => {
    render(
      <ProfileAccountSummary
        summary={RESUMEN}
        storeCredits={[
          { organization: { id: 'a', name: 'Tienda A', slug: 'tienda-a' }, amount: 50_000 },
          { organization: { id: 'b', name: 'Tienda B', slug: 'tienda-b' }, amount: 30_000 },
        ]}
      />
    )

    expect(screen.getByText('Saldo a favor en tiendas')).toBeInTheDocument()
    expect(screen.getByText(/no se puede usar en otra/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tienda A' })).toHaveAttribute('href', '/tienda-a/perfil')
    expect(screen.getByRole('link', { name: 'Tienda B' })).toHaveAttribute('href', '/tienda-b/perfil')
  })

  it('el widget de una sola tienda ya no aparece en el marketplace', () => {
    const CLIENTE = leer('src/app/(public)/perfil/profile-client.tsx')
    expect(CLIENTE).toContain('{tenantPrefix && (')
    const bloque = CLIENTE.slice(CLIENTE.indexOf('{tenantPrefix && ('))
    expect(bloque.slice(0, 300)).toContain('<PublicStoreCredit')
  })
})
