import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileStores } from '@/components/profile/profile-stores'
import { calculateCustomerAccountSummary } from '@/lib/profile/customer-account-summary'
import { summarizeCustomerStores, type CustomerStoreInfo } from '@/lib/profile/customer-stores'

const TIENDAS = new Map<string, CustomerStoreInfo>([
  ['org-a', { id: 'org-a', name: 'Tienda A', slug: 'tienda-a' }],
  ['org-b', { id: 'org-b', name: 'Tienda B', slug: 'tienda-b' }],
])

const ENTRADA = {
  repairs: [
    // A: una entregada y pagada, una lista con saldo.
    { organization_id: 'org-a', status: 'entregado', final_cost: 100_000, paid_amount: 100_000, payment_status: 'pagado' },
    { organization_id: 'org-a', status: 'listo', final_cost: 200_000, paid_amount: 50_000, payment_status: 'pendiente' },
    // B: una en proceso, sin monto confirmado.
    { organization_id: 'org-b', status: 'reparacion', final_cost: null, estimated_cost: null, paid_amount: 0, payment_status: 'pendiente' },
  ],
  orders: [
    { organization_id: 'org-a', status: 'PENDING', payment_status: 'PENDING', total: 80_000 },
    { organization_id: 'org-b', status: 'COMPLETED', payment_status: 'PAID', total: 45_000 },
  ],
  credits: [
    {
      organization_id: 'org-b',
      status: 'active',
      credit_installments: [{ amount: 60_000, amount_paid: 0, status: 'late', due_date: '2026-08-01' }],
    },
  ],
  storeCreditMovements: [
    { organization_id: 'org-b', amount: 30_000 },
  ],
  organizations: TIENDAS,
}

/**
 * El resumen de cuenta suma todas las tiendas juntas, y entre varias eso no es
 * accionable: «por pagar 800.000» no dice a quien, y un equipo listo no dice
 * donde. El desglose se calcula con la MISMA funcion que el total, asi que las
 * partes tienen que cerrar con el todo.
 */
describe('la cuenta se abre por tienda', () => {
  it('agrupa cada movimiento en su tienda', () => {
    const tiendas = summarizeCustomerStores(ENTRADA)
    expect(tiendas).toHaveLength(2)

    const a = tiendas.find((t) => t.organizationId === 'org-a')!
    const b = tiendas.find((t) => t.organizationId === 'org-b')!

    expect(a.summary.equipment.total).toBe(2)
    expect(a.summary.equipment.ready).toBe(1)
    expect(a.summary.repairs.pendingAmount).toBe(150_000)
    expect(a.summary.orders.pendingAmount).toBe(80_000)

    expect(b.summary.equipment.total).toBe(1)
    expect(b.summary.equipment.active).toBe(1)
    expect(b.summary.financing.overdueCount).toBe(1)
    expect(b.summary.storeCredit).toBe(30_000)
  })

  it('las partes cierran con el total general', () => {
    // Si algun dia se separan, el perfil muestra un total que no coincide con la
    // suma de lo que lista debajo.
    const total = calculateCustomerAccountSummary(ENTRADA)
    const tiendas = summarizeCustomerStores(ENTRADA)
    const sumar = (leer: (t: (typeof tiendas)[number]) => number) =>
      tiendas.reduce((acc, tienda) => acc + leer(tienda), 0)

    expect(sumar((t) => t.summary.totalDue)).toBe(total.totalDue)
    expect(sumar((t) => t.summary.storeCredit)).toBe(total.storeCredit)
    expect(sumar((t) => t.summary.equipment.total)).toBe(total.equipment.total)
    expect(sumar((t) => t.summary.equipment.ready)).toBe(total.equipment.ready)
    expect(sumar((t) => t.summary.repairs.pendingAmount)).toBe(total.repairs.pendingAmount)
    expect(sumar((t) => t.summary.orders.pendingAmount)).toBe(total.orders.pendingAmount)
  })

  it('primero las tiendas donde hay algo que hacer', () => {
    const tiendas = summarizeCustomerStores(ENTRADA)
    expect(tiendas[0].needsAttention).toBe(true)
    // A debe: 150.000 de reparacion + 80.000 de pedido. B debe 60.000 de cuota.
    expect(tiendas[0].organizationId).toBe('org-a')
  })

  it('una tienda al dia no se marca como pendiente', () => {
    const [tienda] = summarizeCustomerStores({
      ...ENTRADA,
      repairs: [{ organization_id: 'org-a', status: 'entregado', final_cost: 100_000, paid_amount: 100_000, payment_status: 'pagado' }],
      orders: [],
      credits: [],
      storeCreditMovements: [],
    })
    expect(tienda.needsAttention).toBe(false)
  })

  it('las filas sin tienda se ignoran en vez de caer en cualquiera', () => {
    // Atribuirlas a una tienda al azar seria peor que no mostrarlas.
    const tiendas = summarizeCustomerStores({
      ...ENTRADA,
      repairs: [{ organization_id: null, status: 'listo', final_cost: 999_000, paid_amount: 0, payment_status: 'pendiente' }],
      orders: [],
      credits: [],
      storeCreditMovements: [],
    })
    expect(tiendas).toHaveLength(0)
  })

  it('sin movimientos no hay tiendas', () => {
    expect(
      summarizeCustomerStores({ repairs: [], orders: [], credits: [], storeCreditMovements: [], organizations: TIENDAS })
    ).toHaveLength(0)
  })
})

describe('el panel dice que hacer y donde', () => {
  it('nombra la tienda, el pendiente y el camino para resolverlo', () => {
    render(<ProfileStores stores={summarizeCustomerStores(ENTRADA)} />)

    expect(screen.getByRole('link', { name: 'Tienda A' })).toHaveAttribute('href', '/tienda-a/perfil')
    expect(screen.getByText(/1 de 2 con algo pendiente|2 de 2 con algo pendiente/)).toBeInTheDocument()

    const filaA = screen.getByRole('link', { name: 'Tienda A' }).closest('li')!
    // A tiene las dos cosas a la vez: un equipo listo y saldo por pagar.
    expect(within(filaA).getByText('Equipo para retirar y saldo por pagar')).toBeInTheDocument()
    expect(within(filaA).getAllByRole('link').some((l) => l.getAttribute('href') === '/tienda-a/mis-reparaciones')).toBe(true)
  })

  it('avisa de las cuotas vencidas de cada tienda', () => {
    render(<ProfileStores stores={summarizeCustomerStores(ENTRADA)} />)
    const filaB = screen.getByRole('link', { name: 'Tienda B' }).closest('li')!
    expect(within(filaB).getByText('1 cuota vencida')).toBeInTheDocument()
  })

  it('sin tiendas no pinta nada', () => {
    const { container } = render(<ProfileStores stores={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

/**
 * El panel solo aporta con mas de una tienda: con una sola repetiria el resumen
 * de arriba. Y el formulario de datos personales encabezaba la columna, cuando
 * es lo que menos se usa: empujaba pedidos, favoritos y carritos abajo del todo.
 */
describe('el perfil ordena la pagina por lo que se usa', () => {
  const CLIENTE = readFileSync(resolve(process.cwd(), 'src/app/(public)/perfil/profile-client.tsx'), 'utf8')

  it('el desglose aparece solo con varias tiendas', () => {
    expect(CLIENTE).toContain('{stores.length > 1 && (')
  })

  it('va debajo del resumen: primero el total, despues de quien es cada parte', () => {
    expect(CLIENTE.indexOf('<ProfileAccountSummary')).toBeLessThan(CLIENTE.indexOf('<ProfileStores'))
  })

  it('los datos personales quedan al final de la columna', () => {
    const ordersIndex = Math.max(
      CLIENTE.indexOf('<ProfileOrderHistory'),
      CLIENTE.indexOf('<ProfileOrders')
    )
    expect(ordersIndex).toBeGreaterThanOrEqual(0)
    expect(CLIENTE.indexOf('<ProfileForm')).toBeGreaterThanOrEqual(0)
    expect(CLIENTE.indexOf('<ProfileFavoritesWidget')).toBeLessThan(CLIENTE.indexOf('<ProfileForm'))
  })
})
